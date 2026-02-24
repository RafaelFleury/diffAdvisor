use notify::{Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::Path;
use std::process::Command;
use tauri::Emitter;

pub fn start_watcher(
    repo_path: String,
    app_handle: tauri::AppHandle,
) -> Result<RecommendedWatcher, String> {
    let refs_path = Path::new(&repo_path).join(".git").join("refs").join("heads");

    if !refs_path.exists() {
        return Err(format!(
            "Git refs directory not found: {:?}",
            refs_path
        ));
    }

    let repo_path_clone = repo_path.clone();
    let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
        if let Ok(_event) = res {
            // Get the latest commit hash
            if let Ok(output) = Command::new("git")
                .args(["log", "-1", "--format=%H"])
                .current_dir(&repo_path_clone)
                .output()
            {
                if output.status.success() {
                    let hash = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    let _ = app_handle.emit("commit_detected", &hash);
                }
            }
        }
    })
    .map_err(|e| format!("Failed to create watcher: {}", e))?;

    watcher
        .watch(&refs_path, RecursiveMode::NonRecursive)
        .map_err(|e| format!("Failed to watch {:?}: {}", refs_path, e))?;

    Ok(watcher)
}
