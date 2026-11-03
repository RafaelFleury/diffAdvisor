use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::State;

use crate::services::ai::{AiConfig, LlmConfig};
use crate::services::agent::{self, AgentConfig, AgentKind};
use crate::services::opencode::{self, ModelInfo};
use crate::services::secrets;
use crate::state::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentStatusDto {
    pub installed: bool,
    pub path: Option<String>,
    pub version: Option<String>,
}

/// Scratch space for agent CLI runs, outside any user repository.
pub fn agent_dir(name: &str) -> Result<PathBuf, String> {
    let dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("diffAdvisor")
        .join("agent")
        .join(name);
    std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create {:?}: {}", dir, e))?;
    Ok(dir)
}

/// Builds the configured LLM backend. For agent CLIs, `workdir` is the
/// directory the agent may explore (defaults to an empty scratch dir).
pub async fn load_llm_config(
    state: &AppState,
    workdir: Option<&Path>,
    readable_dirs: Vec<PathBuf>,
    timeout: Duration,
) -> Result<LlmConfig, String> {
    let (provider, api_config, models) = {
        let db = state.db();
        let setting = |key: &str| db.get_setting(key).ok().flatten().unwrap_or_default();
        let api_config = AiConfig {
            endpoint_url: setting("ai.endpointUrl"),
            model: setting("ai.model"),
            api_key: secrets::load_api_key(&db),
            requires_output_cap: db.get_setting("ai.requiresOutputCap").ok().flatten(),
        };
        let models = [
            setting("ai.opencodeModel"),
            setting("ai.claudeCodeModel"),
            setting("ai.codexModel"),
        ];
        (setting("ai.provider"), api_config, models)
    };

    let Some(kind) = AgentKind::from_provider(&provider) else {
        if api_config.endpoint_url.is_empty() || api_config.model.is_empty() {
            return Err("AI endpoint URL and model must be configured in Settings".to_string());
        }
        return Ok(LlmConfig::Api(api_config));
    };

    let binary = agent::find_binary(kind).ok_or_else(|| {
        format!(
            "{} was not found. Install it (see {}) or pick another AI provider in Settings.",
            kind.label(),
            install_hint(kind)
        )
    })?;

    let [opencode_model, claude_code_model, codex_model] = models;
    let model = match kind {
        // opencode needs an explicit model; fall back to its first free one.
        AgentKind::Opencode if opencode_model.is_empty() => opencode::list_free_models(&binary)
            .await?
            .into_iter()
            .next()
            .map(|m| m.id)
            .ok_or("No free opencode models are available. Pick a model in Settings.")?,
        AgentKind::Opencode => opencode_model,
        AgentKind::ClaudeCode => claude_code_model.trim().to_string(),
        AgentKind::Codex => codex_model.trim().to_string(),
    };

    let workdir = match workdir {
        Some(dir) => dir.to_path_buf(),
        None => agent_dir("work")?,
    };

    Ok(LlmConfig::Agent(AgentConfig {
        kind,
        binary,
        model,
        workdir,
        readable_dirs,
        timeout,
        progress: None,
        cancel: Some(state.ai_cancel.clone()),
    }))
}

fn install_hint(kind: AgentKind) -> &'static str {
    match kind {
        AgentKind::Opencode => "https://opencode.ai",
        AgentKind::ClaudeCode => "https://claude.com/claude-code",
        AgentKind::Codex => "https://developers.openai.com/codex/cli",
    }
}

/// Whether the CLI for `provider` (`opencode`, `claude-code` or `codex`) is installed.
#[tauri::command]
pub async fn get_agent_status(provider: String) -> Result<AgentStatusDto, String> {
    let kind = AgentKind::from_provider(&provider).ok_or_else(|| format!("Unknown agent provider: {}", provider))?;
    let Some(binary) = agent::find_binary(kind) else {
        return Ok(AgentStatusDto {
            installed: false,
            path: None,
            version: None,
        });
    };
    Ok(AgentStatusDto {
        installed: true,
        version: agent::version(&binary).await,
        path: Some(binary.to_string_lossy().to_string()),
    })
}

#[tauri::command]
pub async fn list_opencode_models() -> Result<Vec<ModelInfo>, String> {
    let binary = agent::find_binary(AgentKind::Opencode).ok_or("opencode was not found")?;
    opencode::list_free_models(&binary).await
}

/// Stops any in-flight agent run (debrief, checkpoint or note generation).
#[tauri::command]
pub async fn cancel_ai_run(state: State<'_, AppState>) -> Result<(), String> {
    state.ai_cancel.notify_waiters();
    Ok(())
}
