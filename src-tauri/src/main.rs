#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::PathBuf;

use tauri::Manager;
use diffadvisor_lib::db::Database;
use diffadvisor_lib::state::AppState;
use diffadvisor_lib::commands;
use diffadvisor_lib::services::watcher;

fn main() {
    let db_path = get_db_path();

    // Ensure parent directory exists
    if let Some(parent) = db_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let db_path_str = db_path.to_string_lossy().to_string();
    let db = Database::open(&db_path_str).expect("Failed to open database");
    let state = AppState::new(db);

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(state)
        .setup(|app| {
            let state = app.state::<AppState>();
            let project_path = {
                let db = state.db();
                db.get_setting("active_project_id")
                    .ok()
                    .flatten()
                    .and_then(|id_str| id_str.parse::<i64>().ok())
                    .and_then(|id| db.get_project(id).ok())
                    .map(|p| p.path.clone())
            };
            if let Some(path) = project_path {
                let handle = app.handle().clone();
                if let Ok(w) = watcher::start_watcher(path, handle) {
                    state.set_watcher(Some(w));
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::projects::add_project,
            commands::projects::list_projects,
            commands::projects::remove_project,
            commands::projects::get_active_project,
            commands::projects::set_active_project,
            commands::debriefs::get_pending_commits,
            commands::debriefs::get_reviewed_commits,
            commands::debriefs::get_debrief_by_commit,
            commands::debriefs::run_debrief,
            commands::debriefs::get_diff_content,
            commands::debriefs::mark_reviewed,
            commands::debriefs::get_gap_count,
            commands::checkpoints::submit_checkpoint,
            commands::checkpoints::get_checkpoint_responses,
            commands::knowledge::get_notes,
            commands::knowledge::get_note,
            commands::knowledge::save_note,
            commands::knowledge::delete_note,
            commands::knowledge::search_notes,
            commands::knowledge::write_to_kb,
            commands::settings::get_settings,
            commands::settings::update_settings,
            commands::settings::get_skills,
            commands::settings::toggle_skill,
            commands::settings::add_skill,
            commands::settings::test_connection,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn get_db_path() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("diffAdvisor")
        .join("diffadvisor.db")
}
