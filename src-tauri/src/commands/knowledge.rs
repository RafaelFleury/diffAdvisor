use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};

use crate::db::models::KnowledgeNote;
use crate::services::{ai, knowledge as kb_service};
use crate::state::AppState;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct KbProgressEvent {
    debrief_id: i64,
    message: String,
}

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

    let content = if note.auto_generated {
        ai::normalize_kb_note_markdown(&note.title, &content)
    } else {
        content
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

fn get_kb_path_str(state: &AppState) -> String {
    let db = state.db();
    db.get_setting("knowledge.storagePath")
        .ok()
        .flatten()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "~/knowledge_base".to_string())
}

pub(crate) fn get_kb_root(state: &AppState) -> std::path::PathBuf {
    kb_service::expand_kb_path(&get_kb_path_str(state))
}

fn note_is_visible_in_root(note: &KnowledgeNote, kb_root: &Path) -> bool {
    !note.file_path.is_empty()
        && Path::new(&note.file_path).exists()
        && kb_service::is_note_path_in_root(Path::new(&note.file_path), kb_root)
}

/// Brings the DB index in line with the files on disk. Only files whose
/// mtime changed since they were last indexed are read.
fn sync_kb_index(state: &AppState) -> Result<std::path::PathBuf, String> {
    let kb_root = get_kb_root(state);
    let files = kb_service::list_note_files(&kb_root);

    let db = state.db();
    db.dedupe_knowledge_notes_by_file_path()
        .map_err(|e| format!("Failed to dedupe notes: {}", e))?;

    for (path, modified) in files {
        let file_path = path.to_string_lossy().to_string();
        let existing = db
            .get_knowledge_note_by_file_path(&file_path)
            .map_err(|e| format!("Failed to get note by file path: {}", e))?;

        if let Some(ref note) = existing {
            if db.get_note_file_mtime(note.id).unwrap_or(0) == modified {
                continue;
            }
        }

        let scanned = kb_service::index_note_file(&kb_root, &path);
        let id = match existing {
            Some(note) => {
                if note.title != scanned.title
                    || note.category_path != scanned.category_path
                    || note.tags != scanned.tags
                {
                    db.update_knowledge_note(
                        note.id,
                        &scanned.title,
                        &scanned.category_path,
                        &file_path,
                        &scanned.tags,
                        &note.links_to,
                    )
                    .map_err(|e| format!("Failed to sync KB note metadata: {}", e))?;
                }
                note.id
            }
            None => {
                db.create_knowledge_note(
                    None,
                    &scanned.title,
                    &scanned.category_path,
                    &file_path,
                    scanned.auto_generated,
                    &scanned.tags,
                    None,
                    None,
                    &[],
                )
                .map_err(|e| format!("Failed to index KB note: {}", e))?
                .id
            }
        };

        db.index_note_content(
            id,
            &scanned.title,
            &scanned.tags,
            &scanned.category_path,
            &scanned.content,
            modified,
        )
        .map_err(|e| format!("Failed to index KB note content: {}", e))?;
    }

    db.prune_note_index()
        .map_err(|e| format!("Failed to prune KB index: {}", e))?;

    Ok(kb_root)
}

/// Notes matching any of `terms`, best first, found through the full-text
/// index (no LLM involved). Used to seed prompts with relevant notes.
pub(crate) fn find_related_notes(
    state: &AppState,
    terms: &[String],
    exclude_file: Option<&Path>,
    limit: usize,
) -> Vec<kb_service::RelatedNote> {
    let Some(query) = kb_service::fts_any_terms_query(terms) else {
        return Vec::new();
    };
    let Ok(kb_root) = sync_kb_index(state) else {
        return Vec::new();
    };
    let db = state.db();
    db.search_note_index(&query, limit + 1)
        .unwrap_or_default()
        .into_iter()
        .filter(|(note, _)| note_is_visible_in_root(note, &kb_root))
        .filter(|(note, _)| exclude_file.is_none_or(|ex| Path::new(&note.file_path) != ex))
        .take(limit)
        .map(|(note, content)| kb_service::RelatedNote {
            title: note.title,
            category_path: note.category_path,
            file_path: note.file_path,
            excerpt: kb_service::note_excerpt(&content, 600),
        })
        .collect()
}

fn list_visible_notes(state: &AppState) -> Result<Vec<KnowledgeNote>, String> {
    let kb_root = sync_kb_index(state)?;
    let db = state.db();
    let notes = db
        .list_knowledge_notes()
        .map_err(|e| format!("Failed to list notes: {}", e))?;

    Ok(notes
        .into_iter()
        .filter(|note| note_is_visible_in_root(note, &kb_root))
        .collect())
}

#[tauri::command]
pub async fn get_notes(state: State<'_, AppState>) -> Result<Vec<KnowledgeNoteDto>, String> {
    let notes = list_visible_notes(state.inner())?;
    Ok(notes.iter().map(note_to_dto).collect())
}

#[tauri::command]
pub async fn get_note(
    state: State<'_, AppState>,
    note_id: i64,
) -> Result<Option<KnowledgeNoteDto>, String> {
    let kb_root = sync_kb_index(state.inner())?;
    let db = state.db();
    match db.get_knowledge_note(note_id) {
        Ok(note) if note_is_visible_in_root(&note, &kb_root) => Ok(Some(note_to_dto(&note))),
        Ok(_) => Ok(None),
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
    let category_path = kb_service::sanitize_category(&category_path);
    let kb_path = get_kb_root(state.inner());
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
        let path = Path::new(&note.file_path);
        if !note.file_path.is_empty() && kb_service::is_note_path_in_root(path, &get_kb_root(state.inner())) {
            let _ = std::fs::remove_file(path);
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
    let Some(match_query) = kb_service::fts_user_query(&query) else {
        return get_notes(state).await;
    };
    let kb_root = sync_kb_index(state.inner())?;
    let db = state.db();
    let results = db
        .search_note_index(&match_query, 200)
        .map_err(|e| format!("Failed to search notes: {}", e))?;
    Ok(results
        .iter()
        .filter(|(note, _)| note_is_visible_in_root(note, &kb_root))
        .map(|(note, _)| note_to_dto(note))
        .collect())
}

#[tauri::command]
pub async fn write_to_kb(
    app_handle: AppHandle,
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
    let kb_path = sync_kb_index(state.inner())?;
    // The agent runs inside the KB so it can read related notes itself; the app
    // still does all the writing.
    let mut ai_config = super::llm::load_llm_config(
        state.inner(),
        Some(&kb_path),
        Vec::new(),
        std::time::Duration::from_secs(5 * 60),
    )
    .await?;
    let emit_progress = {
        let handle = app_handle.clone();
        Arc::new(move |message: &str| {
            let _ = handle.emit(
                "kb_progress",
                KbProgressEvent {
                    debrief_id,
                    message: message.to_string(),
                },
            );
        })
    };
    if let ai::LlmConfig::Opencode(ref mut oc) = ai_config {
        oc.progress = Some(emit_progress.clone());
    }

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

    let total = note_indices.len();
    for (position, idx) in note_indices.into_iter().enumerate() {
        if idx >= ai_response.suggested_notes.len() {
            continue;
        }

        let suggested = &ai_response.suggested_notes[idx];
        let category = kb_service::sanitize_category(&suggested.category);
        emit_progress(&format!("Note {}/{}: {}", position + 1, total, suggested.title));

        // Check for existing note (prefer category+title exact path, fallback to title lookup)
        let preferred_existing_path = kb_path
            .join(&category)
            .join(format!("{}.md", kb_service::sanitize_filename(&suggested.title)));
        let existing_content = if preferred_existing_path.exists() {
            std::fs::read_to_string(&preferred_existing_path).ok()
        } else {
            kb_service::find_existing_note(&kb_path, &suggested.title)
                .and_then(|path| std::fs::read_to_string(path).ok())
        }
        .map(|raw| kb_service::strip_yaml_frontmatter(&raw));

        let search_text = format!(
            "{} {} {} {}",
            suggested.title,
            suggested.tags.join(" "),
            suggested.links_to.join(" "),
            category.replace('/', " ")
        );
        let related = find_related_notes(
            state.inner(),
            &kb_service::extract_search_terms(&search_text, 12),
            Some(&preferred_existing_path),
            4,
        );

        let note_input = ai::KbNoteInput {
            title: suggested.title.clone(),
            category: category.clone(),
            tags: suggested.tags.clone(),
            links_to: suggested.links_to.clone(),
            existing_content,
            full_debrief_json: full_debrief_json.clone(),
            diff_snippet: diff_snippet.clone(),
            commit_message: debrief.commit_message.clone(),
            project_name: project_name.clone(),
            existing_titles: existing_titles.clone(),
            existing_notes_catalog: existing_notes_catalog.clone(),
            related_notes: kb_service::format_related_notes(&related),
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
            let dir = kb_service::ensure_kb_dir(&kb_path, &category)?;
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
                .get_knowledge_note_by_file_path(&file_path_str)
                .map_err(|e| format!("Failed to get note by file path: {}", e))?;

            let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
            let created_date = existing_note
                .as_ref()
                .map(|n| n.created_at.chars().take(10).collect::<String>())
                .unwrap_or_else(|| today.clone());

            let fm = kb_service::NoteFrontmatter {
                title: generated.title.clone(),
                tags: suggested.tags.clone(),
                category: category.clone(),
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
                    &category,
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
                    &category,
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
