//! Codex adapter (`codex exec`), using the user's own Codex login and config.
//!
//! Runs use the read-only sandbox: the agent can run shell commands to read
//! and search files, but cannot write anywhere or reach the network from
//! them. Unlike the other CLIs, the sandbox does not limit which folders it
//! may read. No session is saved.

use std::path::{Path, PathBuf};

use super::agent::{self, AgentConfig, EventParser, Invocation};

const MAX_COMMAND_CHARS: usize = 80;

pub fn invocation(config: &AgentConfig, prompt: &str) -> Invocation {
    let mut command = agent::base_command(&config.binary);
    command
        .args(["exec", "--json", "--sandbox", "read-only", "--skip-git-repo-check", "--ephemeral"])
        .arg("--cd")
        .arg(&config.workdir);
    if !config.model.is_empty() {
        command.args(["--model", &config.model]);
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
                self.error = event["message"].as_str().map(str::to_string);
                None
            }
            ("turn.failed", _) => {
                self.error = Some(event["error"]["message"].as_str().unwrap_or("turn failed").to_string());
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
    fn reports_failed_turns() {
        let mut parser = Parser::new(Path::new("/repo"));
        parser.handle_line(r#"{"type":"turn.failed","error":{"message":"model not supported"}}"#);
        assert_eq!(Box::new(parser).finish(), Err("model not supported".to_string()));
    }
}
