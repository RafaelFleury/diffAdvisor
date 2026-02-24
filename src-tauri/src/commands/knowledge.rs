use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::models::KnowledgeNote;
use crate::services::{ai, knowledge as kb_service};
use crate::state::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeNoteDto {
    pub id: String,
    pub project_id: Option<String>,
    pub title: String,
    pub category_path: String,
    pub file_path: String,
    pub content: String,
    pub auto_generated: bool,
    pub tags: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
}

fn note_to_dto(note: &KnowledgeNote) -> KnowledgeNoteDto {
    let content = if !note.file_path.is_empty() {
        std::fs::read_to_string(&note.file_path).unwrap_or_default()
    } else {
        String::new()
    };

    KnowledgeNoteDto {
        id: note.id.to_string(),
        project_id: note.project_id.map(|id| id.to_string()),
        title: note.title.clone(),
        category_path: note.category_path.clone(),
        file_path: note.file_path.clone(),
        content,
        auto_generated: note.auto_generated,
        tags: note.tags.clone(),
        created_at: note.created_at.clone(),
        updated_at: note.updated_at.clone(),
    }
}

#[tauri::command]
pub async fn get_notes(state: State<'_, AppState>) -> Result<Vec<KnowledgeNoteDto>, String> {
    let db = state.db();
    let notes = db
        .list_knowledge_notes()
        .map_err(|e| format!("Failed to list notes: {}", e))?;

    Ok(notes.iter().map(note_to_dto).collect())
}

#[tauri::command]
pub async fn get_note(
    state: State<'_, AppState>,
    note_id: i64,
) -> Result<Option<KnowledgeNoteDto>, String> {
    let db = state.db();
    match db.get_knowledge_note(note_id) {
        Ok(note) => Ok(Some(note_to_dto(&note))),
        Err(crate::db::error::DbError::NotFound) => Ok(None),
        Err(e) => Err(format!("Failed to get note: {}", e)),
    }
}

#[tauri::command]
pub async fn save_note(
    state: State<'_, AppState>,
    title: String,
    content: String,
    category_path: String,
    tags: Vec<String>,
    note_id: Option<i64>,
) -> Result<KnowledgeNoteDto, String> {
    let kb_path_str = {
        let db = state.db();
        db.get_setting("knowledge.storagePath")
            .ok()
            .flatten()
            .unwrap_or_else(|| "~/knowledge_base".to_string())
    };

    let kb_path = kb_service::expand_kb_path(&kb_path_str);
    let dir = kb_service::ensure_kb_dir(&kb_path, &category_path)?;

    let filename = kb_service::sanitize_filename(&title);
    let file_path = dir.join(format!("{}.md", filename));

    let fm = kb_service::NoteFrontmatter {
        title: title.clone(),
        tags: tags.clone(),
        category: category_path.clone(),
        source_project: String::new(),
        source_commit: String::new(),
        auto_generated: false,
        created: chrono::Utc::now().format("%Y-%m-%d").to_string(),
        updated: Some(chrono::Utc::now().format("%Y-%m-%d").to_string()),
    };

    kb_service::write_note_atomic(&file_path, &fm, &content)?;

    let file_path_str = file_path.to_string_lossy().to_string();

    let db = state.db();
    if let Some(id) = note_id {
        db.update_knowledge_note(id, &title, &category_path, &file_path_str, &tags, &[])
            .map_err(|e| format!("Failed to update note: {}", e))?;
        let note = db.get_knowledge_note(id).map_err(|e| format!("Failed to get note: {}", e))?;
        Ok(note_to_dto(&note))
    } else {
        let note = db
            .create_knowledge_note(None, &title, &category_path, &file_path_str, false, &tags, None, None, &[])
            .map_err(|e| format!("Failed to create note: {}", e))?;
        Ok(note_to_dto(&note))
    }
}

#[tauri::command]
pub async fn delete_note(state: State<'_, AppState>, note_id: i64) -> Result<(), String> {
    let db = state.db();
    // Get the note to find the file path
    if let Ok(note) = db.get_knowledge_note(note_id) {
        if !note.file_path.is_empty() {
            let _ = std::fs::remove_file(&note.file_path);
        }
    }

    db.delete_knowledge_note(note_id)
        .map_err(|e| format!("Failed to delete note: {}", e))
}

#[tauri::command]
pub async fn search_notes(
    state: State<'_, AppState>,
    query: String,
) -> Result<Vec<KnowledgeNoteDto>, String> {
    let db = state.db();
    let notes = db
        .search_knowledge_notes(&query)
        .map_err(|e| format!("Failed to search notes: {}", e))?;

    Ok(notes.iter().map(note_to_dto).collect())
}

#[tauri::command]
pub async fn write_to_kb(
    state: State<'_, AppState>,
    debrief_id: i64,
    note_indices: Vec<usize>,
) -> Result<Vec<KnowledgeNoteDto>, String> {
    // 1. Get debrief and parse suggested notes
    let (debrief, project_name, commit_hash) = {
        let db = state.db();
        let debrief = db
            .get_debrief(debrief_id)
            .map_err(|e| format!("Debrief not found: {}", e))?;

        let project = db
            .get_project(debrief.project_id)
            .map_err(|e| format!("Project not found: {}", e))?;

        (debrief.clone(), project.name.clone(), debrief.commit_hash.clone())
    };

    let ai_response: ai::DebriefResponse = debrief
        .ai_response_json
        .as_ref()
        .and_then(|json| serde_json::from_str(json).ok())
        .ok_or("No AI response found for this debrief")?;

    // 2. Get settings
    let (kb_path_str, ai_config) = {
        let db = state.db();
        let kb_path = db.get_setting("knowledge.storagePath").ok().flatten().unwrap_or_else(|| "~/knowledge_base".to_string());
        let endpoint = db.get_setting("ai.endpointUrl").ok().flatten().unwrap_or_default();
        let model = db.get_setting("ai.model").ok().flatten().unwrap_or_default();
        let api_key = db.get_setting("ai.apiKey").ok().flatten().unwrap_or_default();
        let output_cap = db.get_setting("ai.requiresOutputCap").ok().flatten();
        (
            kb_path,
            ai::AiConfig {
                endpoint_url: endpoint,
                model,
                api_key,
                requires_output_cap: output_cap,
            },
        )
    };

    let kb_path = kb_service::expand_kb_path(&kb_path_str);

    // 3. Get existing KB titles
    let existing_titles: Vec<String> = kb_service::list_existing_note_titles(&kb_path)
        .into_iter()
        .map(|(title, _)| title)
        .collect();

    // 4. Get diff snippet
    let diff_snippet = debrief.diff_content.chars().take(3000).collect::<String>();

    // 5. Process each selected note
    let mut created_notes = Vec::new();

    for idx in note_indices {
        if idx >= ai_response.suggested_notes.len() {
            continue;
        }

        let suggested = &ai_response.suggested_notes[idx];

        // Check for existing note
        let existing_content = kb_service::find_existing_note(&kb_path, &suggested.title)
            .and_then(|path| std::fs::read_to_string(path).ok());

        let note_input = ai::KbNoteInput {
            title: suggested.title.clone(),
            category: suggested.category.clone(),
            tags: suggested.tags.clone(),
            links_to: suggested.links_to.clone(),
            existing_content,
            diff_snippet: diff_snippet.clone(),
            commit_message: debrief.commit_message.clone(),
            project_name: project_name.clone(),
            existing_titles: existing_titles.clone(),
        };

        // Generate note with retries
        let mut kb_note = None;
        for attempt in 0..3 {
            match ai::generate_kb_note(&ai_config, &note_input).await {
                Ok(note) => {
                    kb_note = Some(note);
                    break;
                }
                Err(e) => {
                    eprintln!("KB note generation attempt {} failed: {}", attempt + 1, e);
                    if attempt == 2 {
                        eprintln!("Skipping note '{}' after 3 failed attempts", suggested.title);
                    }
                }
            }
        }

        if let Some(generated) = kb_note {
            // Write to disk
            let dir = kb_service::ensure_kb_dir(&kb_path, &suggested.category)?;
            let filename = kb_service::sanitize_filename(&generated.title);
            let file_path = dir.join(format!("{}.md", filename));

            let fm = kb_service::NoteFrontmatter {
                title: generated.title.clone(),
                tags: suggested.tags.clone(),
                category: suggested.category.clone(),
                source_project: project_name.clone(),
                source_commit: commit_hash.clone(),
                auto_generated: true,
                created: chrono::Utc::now().format("%Y-%m-%d").to_string(),
                updated: None,
            };

            kb_service::write_note_atomic(&file_path, &fm, &generated.content)?;

            // Save to DB
            let file_path_str = file_path.to_string_lossy().to_string();
            let db = state.db();
            let note = db
                .create_knowledge_note(
                    Some(debrief.project_id),
                    &generated.title,
                    &suggested.category,
                    &file_path_str,
                    true,
                    &suggested.tags,
                    Some(debrief_id),
                    Some(&commit_hash),
                    &suggested.links_to,
                )
                .map_err(|e| format!("Failed to create KB note record: {}", e))?;

            created_notes.push(note_to_dto(&note));
        }
    }

    Ok(created_notes)
}
