use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::models::Project;
use crate::services::{git, watcher};
use crate::state::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDto {
    pub id: String,
    pub name: String,
    pub path: String,
    pub language: String,
    pub frameworks: Vec<String>,
    pub active_skills: Vec<String>,
    pub created_at: String,
    pub last_analyzed_at: Option<String>,
}

fn project_to_dto(p: &Project) -> ProjectDto {
    ProjectDto {
        id: p.id.to_string(),
        name: p.name.clone(),
        path: p.path.clone(),
        language: p.language.clone(),
        frameworks: p.frameworks.clone(),
        active_skills: p.active_skills.clone(),
        created_at: p.created_at.clone(),
        last_analyzed_at: p.last_analyzed_at.clone(),
    }
}

#[tauri::command]
pub async fn add_project(state: State<'_, AppState>, path: String) -> Result<ProjectDto, String> {
    if !git::is_git_repo(&path) {
        return Err(format!("{} is not a git repository", path));
    }

    let (language, frameworks) = git::detect_project_language(&path);

    let name = std::path::Path::new(&path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("project")
        .to_string();

    let db = state.db();
    let project = db
        .create_project(&name, &path, &language, &frameworks, &[])
        .map_err(|e| format!("Failed to create project: {}", e))?;

    // Sync .gitignore into settings
    let gitignore_path = std::path::Path::new(&path).join(".gitignore");
    if gitignore_path.exists() {
        if let Ok(contents) = std::fs::read_to_string(&gitignore_path) {
            let filtered: Vec<&str> = contents
                .lines()
                .filter(|l| !l.trim().is_empty() && !l.trim_start().starts_with('#'))
                .collect();
            let _ = db.set_setting("project.ignoredPaths", &filtered.join("\n"));
            let _ = db.set_setting("project.hasGitignore", "true");
        }
    } else {
        let _ = db.set_setting("project.hasGitignore", "false");
        let _ = db.set_setting("project.ignoredPaths", "");
    }

    Ok(project_to_dto(&project))
}

#[tauri::command]
pub async fn list_projects(state: State<'_, AppState>) -> Result<Vec<ProjectDto>, String> {
    let db = state.db();
    let projects = db.list_projects().map_err(|e| format!("Failed to list projects: {}", e))?;
    Ok(projects.iter().map(project_to_dto).collect())
}

#[tauri::command]
pub async fn remove_project(state: State<'_, AppState>, project_id: i64) -> Result<(), String> {
    let db = state.db();
    db.delete_project(project_id)
        .map_err(|e| format!("Failed to delete project: {}", e))
}

#[tauri::command]
pub async fn get_active_project(state: State<'_, AppState>) -> Result<Option<ProjectDto>, String> {
    let db = state.db();
    let id_str = db
        .get_setting("active_project_id")
        .map_err(|e| format!("Failed to get setting: {}", e))?;

    match id_str {
        Some(s) if !s.is_empty() => {
            let id: i64 = s.parse().map_err(|_| "Invalid project ID".to_string())?;
            match db.get_project(id) {
                Ok(p) => Ok(Some(project_to_dto(&p))),
                Err(crate::db::error::DbError::NotFound) => Ok(None),
                Err(e) => Err(format!("Failed to get project: {}", e)),
            }
        }
        _ => Ok(None),
    }
}

#[tauri::command]
pub async fn set_active_project(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
    project_id: i64,
) -> Result<(), String> {
    let project_path = {
        let db = state.db();
        db.set_setting("active_project_id", &project_id.to_string())
            .map_err(|e| format!("Failed to set active project: {}", e))?;

        let project = db
            .get_project(project_id)
            .map_err(|e| format!("Failed to get project: {}", e))?;

        // Sync .gitignore into settings
        let gitignore_path = std::path::Path::new(&project.path).join(".gitignore");
        if gitignore_path.exists() {
            if let Ok(contents) = std::fs::read_to_string(&gitignore_path) {
                let filtered: Vec<&str> = contents
                    .lines()
                    .filter(|l| !l.trim().is_empty() && !l.trim_start().starts_with('#'))
                    .collect();
                let _ = db.set_setting("project.ignoredPaths", &filtered.join("\n"));
                let _ = db.set_setting("project.hasGitignore", "true");
            }
        } else {
            let _ = db.set_setting("project.hasGitignore", "false");
            let _ = db.set_setting("project.ignoredPaths", "");
        }

        project.path.clone()
    };

    // Start watcher for the new active project
    match watcher::start_watcher(project_path, app_handle) {
        Ok(w) => state.set_watcher(Some(w)),
        Err(e) => eprintln!("Warning: Failed to start file watcher: {}", e),
    }

    Ok(())
}
