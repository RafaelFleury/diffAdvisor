//! Runs analyses through the `opencode` CLI, which handles the agentic loop
//! (reading files, searching the repo) and context compaction for us.
//!
//! Every run uses a dedicated read-only agent injected via
//! `OPENCODE_CONFIG_CONTENT`: no edits, no shell, no web access, and file
//! reads limited to the working directory plus explicitly allowed paths.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::Notify;

const AGENT_NAME: &str = "diffadvisor";
const FREE_MODELS_PROVIDER: &str = "opencode";

pub type ProgressFn = Arc<dyn Fn(&str) + Send + Sync>;

#[derive(Clone)]
pub struct OpencodeConfig {
    pub binary: PathBuf,
    /// `provider/model`, e.g. `opencode/big-pickle`.
    pub model: String,
    /// Directory the agent runs in (the project repository, or a scratch dir).
    pub workdir: PathBuf,
    /// Extra directories outside `workdir` the agent may read.
    pub readable_dirs: Vec<PathBuf>,
    pub timeout: Duration,
    pub progress: Option<ProgressFn>,
    pub cancel: Option<Arc<Notify>>,
}

impl std::fmt::Debug for OpencodeConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("OpencodeConfig")
            .field("binary", &self.binary)
            .field("model", &self.model)
            .field("workdir", &self.workdir)
            .finish()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub context_window: u64,
}

/// Locates the opencode binary on PATH or in its default install location.
/// Desktop launchers often don't inherit shell PATH additions, so the
/// install-script location is checked explicitly.
pub fn find_binary() -> Option<PathBuf> {
    let names: &[&str] = if cfg!(windows) {
        &["opencode.exe", "opencode.cmd"]
    } else {
        &["opencode"]
    };

    let mut candidates: Vec<PathBuf> = std::env::var_os("PATH")
        .map(|paths| std::env::split_paths(&paths).collect())
        .unwrap_or_default();
    if let Some(home) = dirs::home_dir() {
        candidates.push(home.join(".opencode").join("bin"));
    }

    candidates
        .iter()
        .flat_map(|dir| names.iter().map(move |name| dir.join(name)))
        .find(|path| path.is_file())
}

pub async fn version(binary: &Path) -> Option<String> {
    let output = Command::new(binary).arg("--version").output().await.ok()?;
    let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
    (output.status.success() && !version.is_empty()).then_some(version)
}

/// Lists the zero-cost models offered by opencode's own provider.
pub async fn list_free_models(binary: &Path) -> Result<Vec<ModelInfo>, String> {
    let output = Command::new(binary)
        .args(["models", FREE_MODELS_PROVIDER, "--verbose"])
        .stdin(Stdio::null())
        .output()
        .await
        .map_err(|e| format!("Failed to run opencode models: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "opencode models failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    Ok(parse_free_models(&String::from_utf8_lossy(&output.stdout)))
}

/// Parses `opencode models --verbose` output: each model is a `provider/id`
/// line followed by a pretty-printed JSON object.
fn parse_free_models(stdout: &str) -> Vec<ModelInfo> {
    let mut models = Vec::new();
    let mut current_id: Option<&str> = None;
    let mut json = String::new();

    let flush = |id: Option<&str>, json: &str, models: &mut Vec<ModelInfo>| {
        let Some(id) = id else { return };
        let Ok(meta) = serde_json::from_str::<serde_json::Value>(json) else { return };
        let is_free = ["input", "output"]
            .iter()
            .all(|k| meta["cost"][k].as_f64().unwrap_or(1.0) == 0.0);
        let deprecated = meta["status"].as_str() == Some("deprecated");
        if is_free && !deprecated {
            models.push(ModelInfo {
                id: id.to_string(),
                name: meta["name"].as_str().unwrap_or(id).to_string(),
                context_window: meta["limit"]["context"].as_u64().unwrap_or(0),
            });
        }
    };

    for line in stdout.lines() {
        let is_id_line = !line.starts_with(|c: char| c.is_whitespace() || c == '{' || c == '}')
            && line.contains('/')
            && !line.trim().is_empty();
        if is_id_line {
            flush(current_id, &json, &mut models);
            current_id = Some(line.trim());
            json.clear();
        } else {
            json.push_str(line);
            json.push('\n');
        }
    }
    flush(current_id, &json, &mut models);

    models
}

fn agent_config_json(readable_dirs: &[PathBuf]) -> String {
    let mut external = serde_json::Map::new();
    external.insert("*".to_string(), "deny".into());
    for dir in readable_dirs {
        external.insert(format!("{}/*", dir.to_string_lossy()), "allow".into());
    }

    serde_json::json!({
        "agent": {
            AGENT_NAME: {
                "mode": "primary",
                "description": "diffAdvisor read-only code reviewer",
                "permission": {
                    "edit": "deny",
                    "bash": "deny",
                    "webfetch": "deny",
                    "external_directory": external,
                }
            }
        }
    })
    .to_string()
}

/// Sends `prompt` to opencode and returns the agent's final text answer.
pub async fn run(config: &OpencodeConfig, prompt: &str) -> Result<String, String> {
    let mut child = Command::new(&config.binary)
        .args(["run", "--agent", AGENT_NAME, "--format", "json", "-m", &config.model])
        .arg("--dir")
        .arg(&config.workdir)
        .arg(prompt)
        .current_dir(&config.workdir)
        .env("OPENCODE_CONFIG_CONTENT", agent_config_json(&config.readable_dirs))
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("Failed to start opencode: {}", e))?;

    let stdout = child.stdout.take().ok_or("Failed to capture opencode output")?;
    let mut stderr = child.stderr.take().ok_or("Failed to capture opencode errors")?;
    let stderr_task = tokio::spawn(async move {
        let mut buf = String::new();
        let _ = stderr.read_to_string(&mut buf).await;
        buf
    });

    let mut state = RunState::default();
    let read_events = async {
        let mut lines = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            if let Some(message) = state.handle_event(&line, &config.workdir) {
                if let Some(progress) = &config.progress {
                    progress(&message);
                }
            }
        }
    };

    let cancelled = async {
        match &config.cancel {
            Some(notify) => notify.notified().await,
            None => std::future::pending().await,
        }
    };

    tokio::select! {
        result = tokio::time::timeout(config.timeout, read_events) => {
            if result.is_err() {
                let _ = child.kill().await;
                return Err(format!("opencode timed out after {}s", config.timeout.as_secs()));
            }
        }
        _ = cancelled => {
            let _ = child.kill().await;
            return Err("Cancelled".to_string());
        }
    }

    let status = child
        .wait()
        .await
        .map_err(|e| format!("Failed to wait for opencode: {}", e))?;
    let stderr_text = stderr_task.await.unwrap_or_default();

    if let Some(error) = state.error {
        return Err(format!("opencode error: {}", error));
    }
    if !status.success() {
        return Err(format!("opencode exited with {}: {}", status, stderr_text.trim()));
    }

    let text = state.final_text.trim().to_string();
    if text.is_empty() {
        return Err("opencode returned no answer".to_string());
    }
    Ok(text)
}

#[derive(Default)]
struct RunState {
    /// Text from the latest step only, so narration before tool calls is dropped.
    final_text: String,
    error: Option<String>,
}

impl RunState {
    /// Applies one JSON event line; returns a progress message worth showing.
    fn handle_event(&mut self, line: &str, workdir: &Path) -> Option<String> {
        let event: serde_json::Value = serde_json::from_str(line).ok()?;
        let part = &event["part"];
        match event["type"].as_str()? {
            "step_start" => {
                self.final_text.clear();
                None
            }
            "text" => {
                self.final_text.push_str(part["text"].as_str().unwrap_or_default());
                None
            }
            "tool_use" => Some(describe_tool(part, workdir)),
            "error" => {
                let error = &event["error"];
                self.error = Some(
                    error["data"]["message"]
                        .as_str()
                        .or_else(|| error["name"].as_str())
                        .unwrap_or("unknown error")
                        .to_string(),
                );
                None
            }
            _ => None,
        }
    }
}

fn describe_tool(part: &serde_json::Value, workdir: &Path) -> String {
    let tool = part["tool"].as_str().unwrap_or("tool");
    let input = &part["state"]["input"];
    let field = |key: &str| input[key].as_str().unwrap_or_default();
    let relative = |path: &str| {
        Path::new(path)
            .strip_prefix(workdir)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| path.to_string())
    };
    let failed = part["state"]["status"].as_str() == Some("error");

    let message = match tool {
        "read" => format!("Reading {}", relative(field("filePath"))),
        "grep" => format!("Searching for \"{}\"", field("pattern")),
        "glob" => format!("Finding files {}", field("pattern")),
        "list" => format!("Listing {}", relative(field("path"))),
        other => format!("Using {}", other),
    };
    if failed {
        format!("{} (blocked)", message)
    } else {
        message
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_only_free_models() {
        let stdout = r#"opencode/free-one
{
  "id": "free-one",
  "name": "Free One",
  "status": "active",
  "cost": { "input": 0, "output": 0 },
  "limit": { "context": 200000, "output": 32000 }
}
opencode/paid
{
  "id": "paid",
  "name": "Paid",
  "cost": { "input": 1.5, "output": 3 },
  "limit": { "context": 100000 }
}
opencode/old-free
{
  "name": "Old",
  "status": "deprecated",
  "cost": { "input": 0, "output": 0 },
  "limit": { "context": 1 }
}
"#;
        assert_eq!(
            parse_free_models(stdout),
            vec![ModelInfo {
                id: "opencode/free-one".to_string(),
                name: "Free One".to_string(),
                context_window: 200000,
            }]
        );
    }

    #[test]
    fn keeps_only_text_from_last_step() {
        let workdir = Path::new("/repo");
        let mut state = RunState::default();
        let events = [
            r#"{"type":"step_start","part":{}}"#,
            r#"{"type":"text","part":{"text":"Let me look at the files."}}"#,
            r#"{"type":"tool_use","part":{"tool":"read","state":{"status":"completed","input":{"filePath":"/repo/src/main.rs"}}}}"#,
            r#"{"type":"step_start","part":{}}"#,
            r#"{"type":"text","part":{"text":"{\"ok\":"}}"#,
            r#"{"type":"text","part":{"text":"true}"}}"#,
        ];
        let progress: Vec<String> = events
            .iter()
            .filter_map(|e| state.handle_event(e, workdir))
            .collect();

        assert_eq!(progress, ["Reading src/main.rs"]);
        assert_eq!(state.final_text, "{\"ok\":true}");
        assert!(state.error.is_none());
    }

    #[test]
    fn captures_error_events_and_blocked_tools() {
        let workdir = Path::new("/repo");
        let mut state = RunState::default();
        let blocked = state.handle_event(
            r#"{"type":"tool_use","part":{"tool":"read","state":{"status":"error","input":{"filePath":"/etc/passwd"}}}}"#,
            workdir,
        );
        assert_eq!(blocked.as_deref(), Some("Reading /etc/passwd (blocked)"));

        state.handle_event(
            r#"{"type":"error","error":{"name":"UnknownError","data":{"message":"Model not found"}}}"#,
            workdir,
        );
        assert_eq!(state.error.as_deref(), Some("Model not found"));
    }

    #[test]
    fn agent_config_denies_everything_but_reads() {
        let config: serde_json::Value =
            serde_json::from_str(&agent_config_json(&[PathBuf::from("/tmp/diffs")])).unwrap();
        let permission = &config["agent"][AGENT_NAME]["permission"];
        assert_eq!(permission["edit"], "deny");
        assert_eq!(permission["bash"], "deny");
        assert_eq!(permission["external_directory"]["*"], "deny");
        assert_eq!(permission["external_directory"]["/tmp/diffs/*"], "allow");
    }
}
