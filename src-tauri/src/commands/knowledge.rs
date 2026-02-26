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
        kb_service::read_note(std::path::Path::new(&note.file_path))
            .map(|raw| kb_service::strip_yaml_frontmatter(&raw))
            .unwrap_or_default()
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
    db.dedupe_knowledge_notes_by_file_path()
        .map_err(|e| format!("Failed to dedupe notes: {}", e))?;
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

    let note_body = kb_service::strip_yaml_frontmatter(&content);
    kb_service::write_note_atomic(&file_path, &fm, &note_body)?;

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
    db.dedupe_knowledge_notes_by_file_path()
        .map_err(|e| format!("Failed to dedupe notes: {}", e))?;
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
        db.dedupe_knowledge_notes_by_file_path()
            .map_err(|e| format!("Failed to dedupe notes: {}", e))?;
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

    // 3. Get existing KB notes catalog
    let existing_kb_notes = kb_service::list_existing_note_titles(&kb_path);
    let existing_titles: Vec<String> = existing_kb_notes
        .iter()
        .map(|(title, _)| title.clone())
        .collect();
    let existing_notes_catalog: Vec<String> = existing_kb_notes
        .iter()
        .map(|(title, category)| {
            if category.is_empty() {
                title.clone()
            } else {
                format!("{} :: {}", title, category)
            }
        })
        .collect();

    // 4. Get full debrief and diff snippet
    let full_debrief_json = debrief.ai_response_json.clone().unwrap_or_default();
    let diff_snippet = debrief.diff_content.chars().take(3000).collect::<String>();

    // 5. Process each selected note
    let mut created_notes = Vec::new();

    for idx in note_indices {
        if idx >= ai_response.suggested_notes.len() {
            continue;
        }

        let suggested = &ai_response.suggested_notes[idx];

        // Check for existing note (prefer category+title exact path, fallback to title lookup)
        let preferred_existing_path = kb_path
            .join(&suggested.category)
            .join(format!("{}.md", kb_service::sanitize_filename(&suggested.title)));
        let existing_content = if preferred_existing_path.exists() {
            std::fs::read_to_string(&preferred_existing_path).ok()
        } else {
            kb_service::find_existing_note(&kb_path, &suggested.title)
                .and_then(|path| std::fs::read_to_string(path).ok())
        }
        .map(|raw| kb_service::strip_yaml_frontmatter(&raw));

        let note_input = ai::KbNoteInput {
            title: suggested.title.clone(),
            category: suggested.category.clone(),
            tags: suggested.tags.clone(),
            links_to: suggested.links_to.clone(),
            existing_content,
            full_debrief_json: full_debrief_json.clone(),
            diff_snippet: diff_snippet.clone(),
            commit_message: debrief.commit_message.clone(),
            project_name: project_name.clone(),
            existing_titles: existing_titles.clone(),
            existing_notes_catalog: existing_notes_catalog.clone(),
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
            // Resolve deterministic file path to avoid duplicates across repeated saves
            let dir = kb_service::ensure_kb_dir(&kb_path, &suggested.category)?;
            let preferred_filename = kb_service::sanitize_filename(&suggested.title);
            let generated_filename = kb_service::sanitize_filename(&generated.title);
            let preferred_path = dir.join(format!("{}.md", preferred_filename));
            let generated_path = dir.join(format!("{}.md", generated_filename));
            let file_path = if preferred_path.exists() {
                preferred_path.clone()
            } else if generated_path.exists() {
                generated_path.clone()
            } else {
                preferred_path.clone()
            };
            let file_path_str = file_path.to_string_lossy().to_string();

            // Upsert semantics in DB: if this file already has a note row, update it
            let db = state.db();
            let existing_note = db
                .list_knowledge_notes()
                .map_err(|e| format!("Failed to list notes: {}", e))?
                .into_iter()
                .find(|n| n.file_path == file_path_str);

            let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
            let created_date = existing_note
                .as_ref()
                .map(|n| n.created_at.chars().take(10).collect::<String>())
                .unwrap_or_else(|| today.clone());

            let fm = kb_service::NoteFrontmatter {
                title: generated.title.clone(),
                tags: suggested.tags.clone(),
                category: suggested.category.clone(),
                source_project: project_name.clone(),
                source_commit: commit_hash.clone(),
                auto_generated: true,
                created: created_date,
                updated: existing_note.as_ref().map(|_| today.clone()),
            };

            let note_body = kb_service::strip_yaml_frontmatter(&generated.content);
            kb_service::write_note_atomic(&file_path, &fm, &note_body)?;

            let note = if let Some(existing) = existing_note {
                db.update_knowledge_note(
                    existing.id,
                    &generated.title,
                    &suggested.category,
                    &file_path_str,
                    &suggested.tags,
                    &suggested.links_to,
                )
                .map_err(|e| format!("Failed to update KB note record: {}", e))?;
                db.get_knowledge_note(existing.id)
                    .map_err(|e| format!("Failed to get updated KB note record: {}", e))?
            } else {
                db.create_knowledge_note(
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
                .map_err(|e| format!("Failed to create KB note record: {}", e))?
            };

            created_notes.push(note_to_dto(&note));
        }
    }

    Ok(created_notes)
}
