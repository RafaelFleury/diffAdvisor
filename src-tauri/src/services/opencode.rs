//! opencode adapter: free models listing, the read-only agent definition,
//! the command line and the JSON event parser. Written against opencode 2.x.
//!
//! Every run uses a dedicated agent injected via `OPENCODE_CONFIG_CONTENT`
//! that denies every tool except file reading and searching, with reads
//! outside the working directory limited to explicitly allowed folders.
//! Runs use `--standalone`: the default shared background service does not
//! see `OPENCODE_CONFIG_CONTENT`, so the agent's restrictions would not apply.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Stdio;

use super::agent::{self, AgentConfig, EventParser, Invocation};

const AGENT_NAME: &str = "diffadvisor";
const FREE_MODELS_PROVIDER: &str = "opencode";
/// Tools the analysis agent may use; everything else is denied.
const ALLOWED_TOOLS: &[&str] = &["read", "grep", "glob", "list"];

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub context_window: u64,
}

/// Lists the zero-cost models offered by opencode's own provider.
///
/// `opencode models` (2.x) prints bare `provider/id` lines, so prices and
/// context sizes come from opencode's models.dev cache
/// (`~/.cache/opencode/models.json`), joined by id.
pub async fn list_free_models(binary: &Path) -> Result<Vec<ModelInfo>, String> {
    let output = agent::base_command(binary)
        .arg("models")
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

    let catalog = models_cache_path()
        .and_then(|path| std::fs::read_to_string(path).ok())
        .map(|json| parse_models_cache(&json))
        .unwrap_or_default();
    Ok(select_free_models(&String::from_utf8_lossy(&output.stdout), &catalog))
}

fn models_cache_path() -> Option<PathBuf> {
    let xdg = std::env::var_os("XDG_CACHE_HOME").map(PathBuf::from);
    let home = dirs::home_dir().map(|home| home.join(".cache"));
    [xdg, home]
        .into_iter()
        .flatten()
        .map(|dir| dir.join("opencode").join("models.json"))
        .find(|path| path.is_file())
}

/// Metadata for opencode's own provider, keyed by model id (without prefix).
#[derive(Debug, Clone, PartialEq)]
struct CachedModel {
    name: String,
    context_window: u64,
    free: bool,
    deprecated: bool,
}

fn parse_models_cache(json: &str) -> HashMap<String, CachedModel> {
    let Ok(root) = serde_json::from_str::<serde_json::Value>(json) else {
        return HashMap::new();
    };
    let Some(models) = root[FREE_MODELS_PROVIDER]["models"].as_object() else {
        return HashMap::new();
    };
    models
        .iter()
        .map(|(id, meta)| {
            let free = ["input", "output"]
                .iter()
                .all(|k| meta["cost"][k].as_f64().unwrap_or(1.0) == 0.0);
            (
                id.clone(),
                CachedModel {
                    name: meta["name"].as_str().unwrap_or(id).to_string(),
                    context_window: meta["limit"]["context"].as_u64().unwrap_or(0),
                    free,
                    deprecated: meta["status"].as_str() == Some("deprecated"),
                },
            )
        })
        .collect()
}

/// Free models among those `opencode models` lists right now. A model missing
/// from the cache counts as free only when its id says so (`-free`).
fn select_free_models(models_stdout: &str, catalog: &HashMap<String, CachedModel>) -> Vec<ModelInfo> {
    let prefix = format!("{}/", FREE_MODELS_PROVIDER);
    models_stdout
        .lines()
        .filter_map(|line| line.trim().strip_prefix(&prefix))
        .filter_map(|id| {
            let full_id = format!("{}{}", prefix, id);
            match catalog.get(id) {
                Some(meta) if meta.free && !meta.deprecated => Some(ModelInfo {
                    id: full_id,
                    name: meta.name.clone(),
                    context_window: meta.context_window,
                }),
                Some(_) => None,
                None if id.ends_with("-free") => Some(ModelInfo {
                    id: full_id,
                    name: id.to_string(),
                    context_window: 0,
                }),
                None => None,
            }
        })
        .collect()
}

fn agent_config_json(readable_dirs: &[PathBuf]) -> String {
    let mut external = serde_json::Map::new();
    external.insert("*".to_string(), "deny".into());
    for dir in readable_dirs {
        // opencode 2.x matches `dir/**`; `dir/*` no longer allows anything.
        external.insert(format!("{}/**", dir.to_string_lossy()), "allow".into());
    }

    let mut permission = serde_json::Map::new();
    permission.insert("*".to_string(), "deny".into());
    for tool in ALLOWED_TOOLS {
        permission.insert(tool.to_string(), "allow".into());
    }
    permission.insert("external_directory".to_string(), serde_json::Value::Object(external));

    serde_json::json!({
        "agent": {
            AGENT_NAME: {
                "mode": "primary",
                "description": "diffAdvisor read-only code reviewer",
                "permission": permission,
            }
        }
    })
    .to_string()
}

/// `opencode run` with the read-only agent. The prompt goes as an argument:
/// `opencode run` has no stdin input.
pub fn invocation(config: &AgentConfig, prompt: &str) -> Invocation {
    let mut command = agent::base_command(&config.binary);
    command.args(["run", "--standalone", "--agent", AGENT_NAME, "--format", "json"]);
    if !config.model.is_empty() {
        command.args(["-m", &config.model]);
    }
    // The agent's root is the process working directory, set by the runner
    // (newer opencode releases dropped the `--dir` flag).
    command
        .arg(prompt)
        .env("OPENCODE_CONFIG_CONTENT", agent_config_json(&config.readable_dirs));
    Invocation { command, stdin: None }
}

pub struct Parser {
    workdir: PathBuf,
    /// Text from the latest step only, so narration before tool calls is dropped.
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
            "tool_use" => Some(describe_tool(part, &self.workdir)),
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

    fn finish(self: Box<Self>) -> Result<String, String> {
        match self.error {
            Some(error) => Err(error),
            None => Ok(self.final_text),
        }
    }
}

fn describe_tool(part: &serde_json::Value, workdir: &Path) -> String {
    let tool = part["tool"].as_str().unwrap_or("tool");
    let input = &part["state"]["input"];
    let field = |key: &str| input[key].as_str().unwrap_or_default();
    let failed = part["state"]["status"].as_str() == Some("error");

    let message = match tool {
        // 2.x calls the field `path`; 1.x called it `filePath`.
        "read" => agent::describe_read(
            input["path"].as_str().or_else(|| input["filePath"].as_str()).unwrap_or_default(),
            workdir,
        ),
        "grep" => format!("Searching for \"{}\"", field("pattern")),
        "glob" => format!("Finding files {}", field("pattern")),
        "list" => format!("Listing {}", agent::display_path(field("path"), workdir)),
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
    fn selects_free_listed_models() {
        let cache = r#"{
          "opencode": { "models": {
            "free-one": { "name": "Free One", "cost": { "input": 0, "output": 0 }, "limit": { "context": 200000 } },
            "paid": { "name": "Paid", "cost": { "input": 1.5, "output": 3 }, "limit": { "context": 100000 } },
            "old-free": { "name": "Old", "status": "deprecated", "cost": { "input": 0, "output": 0 } },
            "unlisted-free": { "name": "Unlisted", "cost": { "input": 0, "output": 0 } }
          } },
          "other": { "models": { "x": { "cost": { "input": 0, "output": 0 } } } }
        }"#;
        let stdout = "abacus/gpt-5\nopencode/free-one\nopencode/paid\nopencode/old-free\nopencode/new-alpha-free\nopencode/mystery\nother/x\n";

        assert_eq!(
            select_free_models(stdout, &parse_models_cache(cache)),
            vec![
                ModelInfo {
                    id: "opencode/free-one".to_string(),
                    name: "Free One".to_string(),
                    context_window: 200000,
                },
                ModelInfo {
                    id: "opencode/new-alpha-free".to_string(),
                    name: "new-alpha-free".to_string(),
                    context_window: 0,
                },
            ]
        );
    }

    #[test]
    fn keeps_only_text_from_last_step() {
        let mut state = Parser::new(Path::new("/repo"));
        let events = [
            r#"{"type":"step_start","part":{}}"#,
            r#"{"type":"text","part":{"text":"Let me look at the files."}}"#,
            r#"{"type":"tool_use","part":{"tool":"read","state":{"status":"completed","input":{"path":"/repo/src/main.rs"}}}}"#,
            r#"{"type":"step_start","part":{}}"#,
            r#"{"type":"text","part":{"text":"{\"ok\":"}}"#,
            r#"{"type":"text","part":{"text":"true}"}}"#,
        ];
        let diff_read = r#"{"type":"tool_use","part":{"tool":"read","state":{"status":"completed","input":{"filePath":"/tmp/diffs/abc.diff"}}}}"#;
        assert_eq!(state.handle_line(diff_read).as_deref(), Some("Reading the commit diff"));

        let progress: Vec<String> = events
            .iter()
            .filter_map(|e| state.handle_line(e))
            .collect();

        assert_eq!(progress, ["Reading src/main.rs"]);
        assert_eq!(state.final_text, "{\"ok\":true}");
        assert!(state.error.is_none());
    }

    #[test]
    fn captures_error_events_and_blocked_tools() {
        let mut state = Parser::new(Path::new("/repo"));
        let blocked = state.handle_line(
            r#"{"type":"tool_use","part":{"tool":"read","state":{"status":"error","input":{"filePath":"/etc/passwd"}}}}"#,
        );
        assert_eq!(blocked.as_deref(), Some("Reading passwd (blocked)"));

        state.handle_line(
            r#"{"type":"error","error":{"name":"UnknownError","data":{"message":"Model not found"}}}"#,
        );
        assert_eq!(state.error.as_deref(), Some("Model not found"));
    }

    #[test]
    fn agent_config_denies_everything_but_reads() {
        let config: serde_json::Value =
            serde_json::from_str(&agent_config_json(&[PathBuf::from("/tmp/diffs")])).unwrap();
        let permission = &config["agent"][AGENT_NAME]["permission"];
        assert_eq!(permission["*"], "deny");
        assert_eq!(permission["read"], "allow");
        assert!(permission.get("bash").is_none() && permission.get("edit").is_none());
        assert_eq!(permission["external_directory"]["*"], "deny");
        assert_eq!(permission["external_directory"]["/tmp/diffs/**"], "allow");
    }
}
