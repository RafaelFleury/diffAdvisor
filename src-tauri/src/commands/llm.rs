use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::State;

use crate::services::ai::{AiConfig, LlmConfig};
use crate::services::opencode::{self, ModelInfo, OpencodeConfig};
use crate::services::secrets;
use crate::state::AppState;

pub const PROVIDER_OPENCODE: &str = "opencode";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpencodeStatusDto {
    pub installed: bool,
    pub path: Option<String>,
    pub version: Option<String>,
}

/// Scratch space for opencode runs, outside any user repository.
pub fn opencode_dir(name: &str) -> Result<PathBuf, String> {
    let dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("diffAdvisor")
        .join("opencode")
        .join(name);
    std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create {:?}: {}", dir, e))?;
    Ok(dir)
}

/// Builds the configured LLM backend. For opencode, `workdir` is the
/// directory the agent may explore (defaults to an empty scratch dir).
pub async fn load_llm_config(
    state: &AppState,
    workdir: Option<&Path>,
    readable_dirs: Vec<PathBuf>,
    timeout: Duration,
) -> Result<LlmConfig, String> {
    let (provider, opencode_model, api_config) = {
        let db = state.db();
        let setting = |key: &str| db.get_setting(key).ok().flatten().unwrap_or_default();
        let api_config = AiConfig {
            endpoint_url: setting("ai.endpointUrl"),
            model: setting("ai.model"),
            api_key: secrets::load_api_key(&db),
            requires_output_cap: db.get_setting("ai.requiresOutputCap").ok().flatten(),
        };
        (setting("ai.provider"), setting("ai.opencodeModel"), api_config)
    };

    if provider != PROVIDER_OPENCODE {
        if api_config.endpoint_url.is_empty() || api_config.model.is_empty() {
            return Err("AI endpoint URL and model must be configured in Settings".to_string());
        }
        return Ok(LlmConfig::Api(api_config));
    }

    let binary = opencode::find_binary().ok_or(
        "opencode was not found. Install it from https://opencode.ai or switch the AI provider to API key in Settings.",
    )?;

    let model = if opencode_model.is_empty() {
        opencode::list_free_models(&binary)
            .await?
            .into_iter()
            .next()
            .map(|m| m.id)
            .ok_or("No free opencode models are available. Pick a model in Settings.")?
    } else {
        opencode_model
    };

    let workdir = match workdir {
        Some(dir) => dir.to_path_buf(),
        None => opencode_dir("work")?,
    };

    Ok(LlmConfig::Opencode(OpencodeConfig {
        binary,
        model,
        workdir,
        readable_dirs,
        timeout,
        progress: None,
        cancel: Some(state.ai_cancel.clone()),
    }))
}

#[tauri::command]
pub async fn get_opencode_status() -> Result<OpencodeStatusDto, String> {
    let Some(binary) = opencode::find_binary() else {
        return Ok(OpencodeStatusDto {
            installed: false,
            path: None,
            version: None,
        });
    };
    Ok(OpencodeStatusDto {
        installed: true,
        version: opencode::version(&binary).await,
        path: Some(binary.to_string_lossy().to_string()),
    })
}

#[tauri::command]
pub async fn list_opencode_models() -> Result<Vec<ModelInfo>, String> {
    let binary = opencode::find_binary().ok_or("opencode was not found")?;
    opencode::list_free_models(&binary).await
}

/// Stops any in-flight opencode run (debrief, checkpoint or note generation).
#[tauri::command]
pub async fn cancel_ai_run(state: State<'_, AppState>) -> Result<(), String> {
    state.ai_cancel.notify_waiters();
    Ok(())
}
