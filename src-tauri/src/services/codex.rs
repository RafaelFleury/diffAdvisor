//! Codex adapter (`codex exec`), using the user's own Codex login and config.
//!
//! Runs use the read-only sandbox: the agent can run shell commands to read
//! and search files, but cannot write anywhere or reach the network from
//! them. Unlike the other CLIs, the sandbox does not limit which folders it
//! may read. No session is saved.

use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Stdio;

use super::agent::{self, AgentConfig, EventParser, Invocation, ModelInfo};

const MAX_COMMAND_CHARS: usize = 80;

/// Models the user can pick, plus what Codex uses when none is picked.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CodexModels {
    pub models: Vec<ModelInfo>,
    /// `model` from `~/.codex/config.toml`, if set.
    pub default_model: Option<String>,
    /// `model_reasoning_effort` from `~/.codex/config.toml`, if set.
    pub default_effort: Option<String>,
}

/// Lists Codex's models from `codex debug models`, with the reasoning levels each accepts.
pub async fn list_models(binary: &Path) -> Result<CodexModels, String> {
    let output = agent::base_command(binary)
        .args(["debug", "models"])
        .stdin(Stdio::null())
        .output()
        .await
        .map_err(|e| format!("Failed to run codex debug models: {}", e))?;
    if !output.status.success() {
        return Err(format!(
            "codex debug models failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    let config = dirs::home_dir()
        .map(|home| home.join(".codex").join("config.toml"))
        .and_then(|path| std::fs::read_to_string(path).ok())
        .unwrap_or_default();
    Ok(CodexModels {
        models: parse_models(&String::from_utf8_lossy(&output.stdout)),
        default_model: top_level_setting(&config, "model"),
        default_effort: top_level_setting(&config, "model_reasoning_effort"),
    })
}

/// Models Codex shows in its own picker (`visibility: "list"`).
fn parse_models(json: &str) -> Vec<ModelInfo> {
    let Ok(root) = serde_json::from_str::<serde_json::Value>(json) else {
        return Vec::new();
    };
    root["models"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|model| model["visibility"] == "list")
        .filter_map(|model| {
            let id = model["slug"].as_str()?.to_string();
            Some(ModelInfo {
                name: model["display_name"].as_str().unwrap_or(&id).to_string(),
                context_window: model["context_window"].as_u64().unwrap_or(0),
                reasoning_levels: model["supported_reasoning_levels"]
                    .as_array()
                    .into_iter()
                    .flatten()
                    .filter_map(|level| level["effort"].as_str().or_else(|| level.as_str()))
                    .map(str::to_string)
                    .collect(),
                id,
            })
        })
        .collect()
}

/// A `key = "value"` line before the first `[table]` of a TOML file.
fn top_level_setting(toml: &str, key: &str) -> Option<String> {
    toml.lines()
        .map(str::trim)
        .take_while(|line| !line.starts_with('['))
        .filter_map(|line| line.split_once('='))
        .find(|(name, _)| name.trim() == key)
        .map(|(_, value)| value.trim().trim_matches('"').to_string())
        .filter(|value| !value.is_empty())
}

pub fn invocation(config: &AgentConfig, prompt: &str) -> Invocation {
    let mut command = agent::base_command(&config.binary);
    command
        .args(["exec", "--json", "--sandbox", "read-only", "--skip-git-repo-check", "--ephemeral"])
        .arg("--cd")
        .arg(&config.workdir);
    if !config.model.is_empty() {
        command.args(["--model", &config.model]);
    }
    if !config.effort.is_empty() {
        command
            .arg("--config")
            .arg(format!("model_reasoning_effort=\"{}\"", config.effort));
    }
    // `-` reads the prompt from stdin.
    command.arg("-");
    Invocation {
        command,
        stdin: Some(prompt.to_string()),
    }
}

pub struct Parser {
    workdir: PathBuf,
    /// The latest agent message; earlier ones are narration between commands.
    final_text: String,
    error: Option<String>,
}

impl Parser {
    pub fn new(workdir: &Path) -> Self {
        Parser {
            workdir: workdir.to_path_buf(),
            final_text: String::new(),
            error: None,
        }
    }
}

impl EventParser for Parser {
    fn handle_line(&mut self, line: &str) -> Option<String> {
        let event: serde_json::Value = serde_json::from_str(line).ok()?;
        let item = &event["item"];
        match (event["type"].as_str()?, item["type"].as_str()) {
            ("item.started", Some("command_execution")) => {
                Some(describe_command(item["command"].as_str().unwrap_or_default(), &self.workdir))
            }
            ("item.completed", Some("agent_message")) => {
                self.final_text = item["text"].as_str().unwrap_or_default().to_string();
                None
            }
            ("error", _) => {
                self.error = event["message"].as_str().map(readable_error);
                None
            }
            ("turn.failed", _) => {
                self.error = Some(readable_error(event["error"]["message"].as_str().unwrap_or("turn failed")));
                None
            }
            _ => None,
        }
    }

    fn finish(self: Box<Self>) -> Result<String, String> {
        match self.error {
            Some(error) => Err(error),
            None => Ok(self.final_text),
        }
    }
}

/// API errors arrive as a JSON string inside the message; keep only its text.
fn readable_error(message: &str) -> String {
    serde_json::from_str::<serde_json::Value>(message)
        .ok()
        .and_then(|json| json["error"]["message"].as_str().map(str::to_string))
        .unwrap_or_else(|| message.to_string())
}

/// `/bin/bash -lc 'rg -n foo src'` becomes `Running rg -n foo src`.
fn describe_command(command: &str, workdir: &Path) -> String {
    let inner = command
        .split_once(" -lc ")
        .map(|(_, rest)| rest.trim().trim_matches(|c| c == '\'' || c == '"'))
        .unwrap_or(command);
    let workdir_prefix = format!("{}/", workdir.to_string_lossy());
    let inner = inner.replace(&workdir_prefix, "").split_whitespace().collect::<Vec<_>>().join(" ");
    let mut shown: String = inner.chars().take(MAX_COMMAND_CHARS).collect();
    if inner.chars().count() > MAX_COMMAND_CHARS {
        shown.push('…');
    }
    format!("Running {}", shown)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reports_commands_and_last_message() {
        let mut parser = Parser::new(Path::new("/repo"));
        let events = [
            r#"{"type":"thread.started","thread_id":"t"}"#,
            r#"{"type":"item.completed","item":{"type":"agent_message","text":"Let me look."}}"#,
            r#"{"type":"item.started","item":{"type":"command_execution","command":"/bin/bash -lc 'cat /repo/src/a.rs'"}}"#,
            r#"{"type":"item.completed","item":{"type":"command_execution","command":"/bin/bash -lc 'cat /repo/src/a.rs'"}}"#,
            r#"{"type":"item.completed","item":{"type":"agent_message","text":"{\"ok\":true}"}}"#,
            r#"{"type":"turn.completed","usage":{}}"#,
        ];
        let progress: Vec<String> = events.iter().filter_map(|e| parser.handle_line(e)).collect();

        assert_eq!(progress, ["Running cat src/a.rs"]);
        assert_eq!(Box::new(parser).finish(), Ok("{\"ok\":true}".to_string()));
    }

    #[test]
    fn parses_models_and_config_defaults() {
        let catalog = r#"{"models":[
            {"slug":"gpt-a","display_name":"GPT A","visibility":"list","context_window":272000,
             "supported_reasoning_levels":[{"effort":"low","description":"x"},{"effort":"high","description":"y"}]},
            {"slug":"hidden","display_name":"Hidden","visibility":"hide","supported_reasoning_levels":[]}
        ]}"#;
        assert_eq!(
            parse_models(catalog),
            vec![ModelInfo {
                id: "gpt-a".to_string(),
                name: "GPT A".to_string(),
                context_window: 272000,
                reasoning_levels: vec!["low".to_string(), "high".to_string()],
            }]
        );

        let config = "model = \"gpt-a\"\nmodel_reasoning_effort = \"high\"\n\n[profiles.x]\nmodel = \"other\"\n";
        assert_eq!(top_level_setting(config, "model").as_deref(), Some("gpt-a"));
        assert_eq!(top_level_setting(config, "model_reasoning_effort").as_deref(), Some("high"));
        assert_eq!(top_level_setting("[x]\nmodel = \"y\"", "model"), None);
    }

    #[test]
    fn unwraps_api_errors() {
        let mut parser = Parser::new(Path::new("/repo"));
        parser.handle_line(
            r#"{"type":"turn.failed","error":{"message":"{\"type\":\"error\",\"error\":{\"message\":\"Invalid value: 'bogus'.\"}}"}}"#,
        );
        assert_eq!(Box::new(parser).finish(), Err("Invalid value: 'bogus'.".to_string()));
    }

    #[test]
    fn reports_failed_turns() {
        let mut parser = Parser::new(Path::new("/repo"));
        parser.handle_line(r#"{"type":"turn.failed","error":{"message":"model not supported"}}"#);
        assert_eq!(Box::new(parser).finish(), Err("model not supported".to_string()));
    }
}
