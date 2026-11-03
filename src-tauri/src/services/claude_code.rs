//! Claude Code adapter (`claude -p`), using the user's own Claude login.
//!
//! Runs are read-only: only the Read, Grep and Glob tools exist, and in
//! non-interactive mode any read outside the working directory and the
//! `--add-dir` folders is denied. The user's settings (hooks, permissions),
//! MCP servers and slash commands are not loaded, and no session is saved.

use std::path::{Path, PathBuf};

use super::agent::{self, AgentConfig, EventParser, Invocation};

pub fn invocation(config: &AgentConfig, prompt: &str) -> Invocation {
    let mut command = agent::base_command(&config.binary);
    command.args([
        "-p",
        "--output-format",
        "stream-json",
        "--verbose",
        "--tools",
        "Read,Grep,Glob",
        "--no-session-persistence",
        "--strict-mcp-config",
        "--disable-slash-commands",
        "--setting-sources",
        "",
    ]);
    if !config.model.is_empty() {
        command.args(["--model", &config.model]);
    }
    if !config.effort.is_empty() {
        command.args(["--effort", &config.effort]);
    }
    for dir in &config.readable_dirs {
        command.arg("--add-dir").arg(dir);
    }
    Invocation {
        command,
        stdin: Some(prompt.to_string()),
    }
}

pub struct Parser {
    workdir: PathBuf,
    result: Option<Result<String, String>>,
}

impl Parser {
    pub fn new(workdir: &Path) -> Self {
        Parser {
            workdir: workdir.to_path_buf(),
            result: None,
        }
    }
}

impl EventParser for Parser {
    fn handle_line(&mut self, line: &str) -> Option<String> {
        let event: serde_json::Value = serde_json::from_str(line).ok()?;
        match event["type"].as_str()? {
            "assistant" => event["message"]["content"]
                .as_array()?
                .iter()
                .filter(|block| block["type"] == "tool_use")
                .map(|block| describe_tool(block, &self.workdir))
                .last(),
            "result" => {
                let text = event["result"].as_str().unwrap_or_default().to_string();
                let failed = event["is_error"].as_bool().unwrap_or(false) || event["subtype"] != "success";
                self.result = Some(if failed {
                    Err(if text.is_empty() {
                        event["subtype"].as_str().unwrap_or("unknown error").to_string()
                    } else {
                        text
                    })
                } else {
                    Ok(text)
                });
                None
            }
            _ => None,
        }
    }

    fn finish(self: Box<Self>) -> Result<String, String> {
        self.result.unwrap_or_else(|| Ok(String::new()))
    }
}

fn describe_tool(block: &serde_json::Value, workdir: &Path) -> String {
    let input = &block["input"];
    let field = |key: &str| input[key].as_str().unwrap_or_default();
    match block["name"].as_str().unwrap_or("tool") {
        "Read" => agent::describe_read(field("file_path"), workdir),
        "Grep" => format!("Searching for \"{}\"", field("pattern")),
        "Glob" => format!("Finding files {}", field("pattern")),
        other => format!("Using {}", other),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reports_tools_and_final_result() {
        let mut parser = Parser::new(Path::new("/repo"));
        let tool = r#"{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Read","input":{"file_path":"/repo/src/main.rs"}}]}}"#;
        let text = r#"{"type":"assistant","message":{"content":[{"type":"text","text":"thinking out loud"}]}}"#;
        let result = r#"{"type":"result","subtype":"success","is_error":false,"result":"{\"ok\":true}"}"#;

        assert_eq!(parser.handle_line(tool).as_deref(), Some("Reading src/main.rs"));
        assert_eq!(parser.handle_line(text), None);
        assert_eq!(parser.handle_line(result), None);
        assert_eq!(Box::new(parser).finish(), Ok("{\"ok\":true}".to_string()));
    }

    #[test]
    fn reports_errors() {
        let mut parser = Parser::new(Path::new("/repo"));
        parser.handle_line(r#"{"type":"result","subtype":"success","is_error":true,"result":"Not logged in"}"#);
        assert_eq!(Box::new(parser).finish(), Err("Not logged in".to_string()));

        let mut parser = Parser::new(Path::new("/repo"));
        parser.handle_line(r#"{"type":"result","subtype":"error_max_turns","is_error":true}"#);
        assert_eq!(Box::new(parser).finish(), Err("error_max_turns".to_string()));
    }
}
