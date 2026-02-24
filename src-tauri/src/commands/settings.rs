use serde::{Deserialize, Serialize};
use tauri::State;

use crate::services::{ai, skills};
use crate::state::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillDto {
    pub id: String,
    pub name: String,
    pub description: String,
    pub tags: Vec<String>,
    pub detect: skills::SkillDetect,
    pub content: String,
    pub enabled: bool,
    pub auto_detected: bool,
    pub built_in: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionResultDto {
    pub success: bool,
    pub message: String,
}

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let db = state.db();
    let json_str = db
        .get_app_settings()
        .map_err(|e| format!("Failed to get settings: {}", e))?;
    serde_json::from_str(&json_str).map_err(|e| format!("Failed to parse settings: {}", e))
}

#[tauri::command]
pub async fn update_settings(
    state: State<'_, AppState>,
    settings: serde_json::Value,
) -> Result<serde_json::Value, String> {
    {
        let db = state.db();

        // Flatten JSON object to key-value pairs
        if let Some(obj) = settings.as_object() {
            for (section, values) in obj {
                if let Some(inner) = values.as_object() {
                    for (key, value) in inner {
                        let flat_key = format!("{}.{}", section, key);
                        let str_value = match value {
                            serde_json::Value::String(s) => s.clone(),
                            serde_json::Value::Bool(b) => b.to_string(),
                            serde_json::Value::Number(n) => n.to_string(),
                            _ => serde_json::to_string(value).unwrap_or_default(),
                        };
                        db.set_setting(&flat_key, &str_value)
                            .map_err(|e| format!("Failed to set {}: {}", flat_key, e))?;
                    }
                }
            }
        }
    } // db guard dropped here

    // Return updated settings
    get_settings(state).await
}

#[tauri::command]
pub async fn get_skills(state: State<'_, AppState>) -> Result<Vec<SkillDto>, String> {
    let all_skills = skills::load_all_skills()?;

    // Get active project's enabled skills
    let active_skills: Vec<String> = {
        let db = state.db();
        let project_id_str = db.get_setting("active_project_id").ok().flatten();
        match project_id_str {
            Some(id_str) => {
                if let Ok(id) = id_str.parse::<i64>() {
                    db.get_project(id)
                        .map(|p| p.active_skills)
                        .unwrap_or_default()
                } else {
                    vec![]
                }
            }
            None => vec![],
        }
    };

    let dtos: Vec<SkillDto> = all_skills
        .iter()
        .map(|s| SkillDto {
            id: s.id.clone(),
            name: s.name.clone(),
            description: s.description.clone(),
            tags: s.tags.clone(),
            detect: s.detect.clone(),
            content: s.content.clone(),
            enabled: active_skills.contains(&s.id),
            auto_detected: false, // Auto-detection happens at analysis time
            built_in: s.built_in,
        })
        .collect();

    Ok(dtos)
}

#[tauri::command]
pub async fn toggle_skill(
    state: State<'_, AppState>,
    skill_id: String,
    enabled: bool,
) -> Result<(), String> {
    let db = state.db();

    let project_id_str = db
        .get_setting("active_project_id")
        .ok()
        .flatten()
        .ok_or("No active project set")?;
    let project_id: i64 = project_id_str
        .parse()
        .map_err(|_| "Invalid project ID".to_string())?;

    let project = db
        .get_project(project_id)
        .map_err(|e| format!("Project not found: {}", e))?;

    let mut skills = project.active_skills;
    if enabled {
        if !skills.contains(&skill_id) {
            skills.push(skill_id);
        }
    } else {
        skills.retain(|s| s != &skill_id);
    }

    db.update_project_skills(project_id, &skills)
        .map_err(|e| format!("Failed to update skills: {}", e))
}

#[tauri::command]
pub async fn add_skill(
    state: State<'_, AppState>,
    name: String,
    content: String,
    tags: Vec<String>,
) -> Result<SkillDto, String> {
    let _ = state; // State not needed for file operation

    let base = dirs::home_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join(".diffAdvisor")
        .join("skills")
        .join("user");

    std::fs::create_dir_all(&base).map_err(|e| format!("Failed to create user skills dir: {}", e))?;

    let slug: String = name
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect();
    let slug = slug.trim_matches('-').to_string();

    let tags_str = format!("[{}]", tags.join(", "));

    let file_content = format!(
        "---\nname: {}\ndetect:\n  files: []\n  content_patterns: []\n  extensions: []\ntags: {}\ndescription: \"\"\n---\n\n{}",
        name, tags_str, content
    );

    let file_path = base.join(format!("{}.md", slug));
    std::fs::write(&file_path, &file_content)
        .map_err(|e| format!("Failed to write skill file: {}", e))?;

    Ok(SkillDto {
        id: slug,
        name,
        description: String::new(),
        tags,
        detect: skills::SkillDetect {
            files: vec![],
            content_patterns: vec![],
            extensions: vec![],
        },
        content,
        enabled: false,
        auto_detected: false,
        built_in: false,
    })
}

#[tauri::command]
pub async fn test_connection(state: State<'_, AppState>) -> Result<ConnectionResultDto, String> {
    let ai_config = {
        let db = state.db();
        let endpoint = db.get_setting("ai.endpointUrl").ok().flatten().unwrap_or_default();
        let model = db.get_setting("ai.model").ok().flatten().unwrap_or_default();
        let api_key = db.get_setting("ai.apiKey").ok().flatten().unwrap_or_default();
        let output_cap = db.get_setting("ai.requiresOutputCap").ok().flatten();
        ai::AiConfig {
            endpoint_url: endpoint,
            model,
            api_key,
            requires_output_cap: output_cap,
        }
    };

    match ai::test_connection(&ai_config).await {
        Ok(_) => Ok(ConnectionResultDto {
            success: true,
            message: "Connection successful".to_string(),
        }),
        Err(e) => Ok(ConnectionResultDto {
            success: false,
            message: format!("Connection failed: {}", e),
        }),
    }
}
