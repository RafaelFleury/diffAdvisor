use tauri::State;

use crate::db::models::Project;
use crate::services::{git, watcher};
use crate::state::AppState;

#[tauri::command]
pub async fn add_project(state: State<'_, AppState>, path: String) -> Result<Project, String> {
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

    Ok(project)
}

#[tauri::command]
pub async fn list_projects(state: State<'_, AppState>) -> Result<Vec<Project>, String> {
    let db = state.db();
    db.list_projects().map_err(|e| format!("Failed to list projects: {}", e))
}

#[tauri::command]
pub async fn remove_project(state: State<'_, AppState>, project_id: i64) -> Result<(), String> {
    let db = state.db();
    db.delete_project(project_id)
        .map_err(|e| format!("Failed to delete project: {}", e))
}

#[tauri::command]
pub async fn get_active_project(state: State<'_, AppState>) -> Result<Option<Project>, String> {
    let db = state.db();
    let id_str = db
        .get_setting("active_project_id")
        .map_err(|e| format!("Failed to get setting: {}", e))?;

    match id_str {
        Some(s) if !s.is_empty() => {
            let id: i64 = s.parse().map_err(|_| "Invalid project ID".to_string())?;
            match db.get_project(id) {
                Ok(p) => Ok(Some(p)),
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
        project.path.clone()
    };

    // Start watcher for the new active project
    match watcher::start_watcher(project_path, app_handle) {
        Ok(w) => state.set_watcher(Some(w)),
        Err(e) => eprintln!("Warning: Failed to start file watcher: {}", e),
    }

    Ok(())
}
