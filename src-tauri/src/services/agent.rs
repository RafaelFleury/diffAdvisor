//! Runs analyses through a coding-agent CLI (opencode, Claude Code or Codex),
//! which handles the agentic loop (reading files, searching the repo) for us.
//!
//! Each CLI has its own module that builds the command line and parses its
//! JSON event stream; this module spawns the process, streams progress,
//! enforces the timeout and handles cancellation.

use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;
use tokio::sync::Notify;

use super::{claude_code, codex, opencode};

pub type ProgressFn = Arc<dyn Fn(&str) + Send + Sync>;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AgentKind {
    Opencode,
    ClaudeCode,
    Codex,
}

impl AgentKind {
    /// Maps the `ai.provider` setting to an agent CLI (`None` for the API provider).
    pub fn from_provider(provider: &str) -> Option<Self> {
        match provider {
            "opencode" => Some(AgentKind::Opencode),
            "claude-code" => Some(AgentKind::ClaudeCode),
            "codex" => Some(AgentKind::Codex),
            _ => None,
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            AgentKind::Opencode => "opencode",
            AgentKind::ClaudeCode => "Claude Code",
            AgentKind::Codex => "Codex",
        }
    }

    fn binary_name(self) -> &'static str {
        match self {
            AgentKind::Opencode => "opencode",
            AgentKind::ClaudeCode => "claude",
            AgentKind::Codex => "codex",
        }
    }

    /// Default install locations, checked after PATH because desktop
    /// launchers often don't inherit shell PATH additions.
    fn install_dirs(self, home: &Path) -> Vec<PathBuf> {
        let mut dirs = vec![home.join(".local").join("bin")];
        match self {
            AgentKind::Opencode => dirs.push(home.join(".opencode").join("bin")),
            AgentKind::ClaudeCode => dirs.push(home.join(".claude").join("local")),
            AgentKind::Codex => {}
        }
        // npm-installed CLIs (Claude Code and Codex can both be installed this way).
        dirs.push(home.join(".npm-global").join("bin"));
        if let Ok(versions) = std::fs::read_dir(home.join(".nvm").join("versions").join("node")) {
            let mut node_bins: Vec<PathBuf> = versions.flatten().map(|v| v.path().join("bin")).collect();
            node_bins.sort();
            node_bins.reverse(); // newest Node first
            dirs.extend(node_bins);
        }
        dirs
    }
}

#[derive(Clone)]
pub struct AgentConfig {
    pub kind: AgentKind,
    pub binary: PathBuf,
    /// Model id in the CLI's own format; empty means the CLI's default.
    pub model: String,
    /// Directory the agent runs in (the project repository, or a scratch dir).
    pub workdir: PathBuf,
    /// Extra directories outside `workdir` the agent may read.
    pub readable_dirs: Vec<PathBuf>,
    pub timeout: Duration,
    pub progress: Option<ProgressFn>,
    pub cancel: Option<Arc<Notify>>,
}

impl std::fmt::Debug for AgentConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("AgentConfig")
            .field("kind", &self.kind)
            .field("binary", &self.binary)
            .field("model", &self.model)
            .field("workdir", &self.workdir)
            .finish()
    }
}

/// How a CLI is invoked for one prompt.
pub struct Invocation {
    pub command: Command,
    /// Written to stdin when set (avoids the OS limit on argument length).
    pub stdin: Option<String>,
}

/// Parses one CLI's JSON event stream.
pub trait EventParser: Send {
    /// Applies one stdout line; returns a progress message worth showing.
    fn handle_line(&mut self, line: &str) -> Option<String>;
    /// The agent's final answer, or the error it reported.
    fn finish(self: Box<Self>) -> Result<String, String>;
}

pub fn find_binary(kind: AgentKind) -> Option<PathBuf> {
    let name = kind.binary_name();
    let names: Vec<String> = if cfg!(windows) {
        vec![format!("{}.exe", name), format!("{}.cmd", name)]
    } else {
        vec![name.to_string()]
    };

    let mut candidates: Vec<PathBuf> = std::env::var_os("PATH")
        .map(|paths| std::env::split_paths(&paths).collect())
        .unwrap_or_default();
    if let Some(home) = dirs::home_dir() {
        candidates.extend(kind.install_dirs(&home));
    }

    candidates
        .iter()
        .flat_map(|dir| names.iter().map(move |name| dir.join(name)))
        .find(|path| path.is_file())
}

pub async fn version(binary: &Path) -> Option<String> {
    let output = base_command(binary).arg("--version").output().await.ok()?;
    if !output.status.success() {
        return None;
    }
    parse_version(&String::from_utf8_lossy(&output.stdout))
}

/// Extracts `1.2.3` from outputs like `codex-cli 1.2.3`, `v1.2.3` or `1.2.3 (Claude Code)`.
fn parse_version(output: &str) -> Option<String> {
    output
        .split_whitespace()
        .map(|word| word.trim_start_matches('v'))
        .find(|word| word.split('.').count() >= 2 && word.split('.').all(|p| !p.is_empty() && p.chars().all(|c| c.is_ascii_digit())))
        .map(str::to_string)
}

/// A command for `binary` whose PATH also includes the binary's own folder,
/// so npm-installed CLIs (`#!/usr/bin/env node`) find their Node runtime even
/// when the app was started from a desktop launcher.
pub fn base_command(binary: &Path) -> Command {
    let mut command = Command::new(binary);
    if let Some(dir) = binary.parent() {
        let mut paths = vec![dir.to_path_buf()];
        if let Some(existing) = std::env::var_os("PATH") {
            paths.extend(std::env::split_paths(&existing));
        }
        if let Ok(joined) = std::env::join_paths(paths) {
            command.env("PATH", joined);
        }
    }
    command
}

/// Sends `prompt` to the configured CLI and returns the agent's final text answer.
pub async fn run(config: &AgentConfig, prompt: &str) -> Result<String, String> {
    let label = config.kind.label();
    let (Invocation { mut command, stdin }, parser): (Invocation, Box<dyn EventParser>) = match config.kind {
        AgentKind::Opencode => (opencode::invocation(config, prompt), Box::new(opencode::Parser::new(&config.workdir))),
        AgentKind::ClaudeCode => (
            claude_code::invocation(config, prompt),
            Box::new(claude_code::Parser::new(&config.workdir)),
        ),
        AgentKind::Codex => (codex::invocation(config, prompt), Box::new(codex::Parser::new(&config.workdir))),
    };

    let mut child = command
        .current_dir(&config.workdir)
        // Some CLIs (opencode 2.x) take their root from $PWD rather than the
        // process working directory, so both must point at the workdir.
        .env("PWD", &config.workdir)
        .stdin(if stdin.is_some() { Stdio::piped() } else { Stdio::null() })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("Failed to start {}: {}", label, e))?;

    if let (Some(text), Some(mut pipe)) = (stdin, child.stdin.take()) {
        tokio::spawn(async move {
            let _ = pipe.write_all(text.as_bytes()).await;
            // Dropping the pipe closes stdin so the CLI knows the prompt is complete.
        });
    }

    let stdout = child.stdout.take().ok_or("Failed to capture agent output")?;
    let mut stderr = child.stderr.take().ok_or("Failed to capture agent errors")?;
    let stderr_task = tokio::spawn(async move {
        let mut buf = String::new();
        let _ = stderr.read_to_string(&mut buf).await;
        buf
    });

    let mut parser = parser;
    let read_events = async {
        let mut lines = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            if let Some(message) = parser.handle_line(&line) {
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
                return Err(format!("{} timed out after {}s", label, config.timeout.as_secs()));
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
        .map_err(|e| format!("Failed to wait for {}: {}", label, e))?;
    let stderr_text = stderr_task.await.unwrap_or_default();

    match parser.finish() {
        Err(error) => Err(format!("{} error: {}", label, error)),
        Ok(_) if !status.success() => Err(format!("{} exited with {}: {}", label, status, stderr_text.trim())),
        Ok(text) if text.trim().is_empty() => Err(format!("{} returned no answer", label)),
        Ok(text) => Ok(text.trim().to_string()),
    }
}

/// A path as shown in progress messages: relative to the working directory,
/// or just the file name when it is outside it (e.g. a knowledge base note).
pub fn display_path(path: &str, workdir: &Path) -> String {
    let path = Path::new(path);
    match path.strip_prefix(workdir) {
        Ok(rel) => rel.to_string_lossy().to_string(),
        Err(_) => path
            .file_name()
            .map(|name| name.to_string_lossy().to_string())
            .unwrap_or_else(|| path.to_string_lossy().to_string()),
    }
}

/// Progress message for a file read; the commit diff gets a friendlier label.
pub fn describe_read(path: &str, workdir: &Path) -> String {
    if path.ends_with(".diff") && !Path::new(path).starts_with(workdir) {
        "Reading the commit diff".to_string()
    } else {
        format!("Reading {}", display_path(path, workdir))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_versions_from_each_cli() {
        assert_eq!(parse_version("2.1.317 (Claude Code)\n").as_deref(), Some("2.1.317"));
        assert_eq!(parse_version("codex-cli 0.165.0\n").as_deref(), Some("0.165.0"));
        assert_eq!(parse_version("v2.2.1\n").as_deref(), Some("2.2.1"));
        assert_eq!(parse_version("unknown"), None);
    }

    #[test]
    fn maps_provider_settings() {
        assert_eq!(AgentKind::from_provider("claude-code"), Some(AgentKind::ClaudeCode));
        assert_eq!(AgentKind::from_provider("codex"), Some(AgentKind::Codex));
        assert_eq!(AgentKind::from_provider("opencode"), Some(AgentKind::Opencode));
        assert_eq!(AgentKind::from_provider("api"), None);
    }

    #[test]
    fn describes_reads() {
        let workdir = Path::new("/repo");
        assert_eq!(describe_read("/repo/src/a.rs", workdir), "Reading src/a.rs");
        assert_eq!(describe_read("/data/diffs/abc.diff", workdir), "Reading the commit diff");
        assert_eq!(describe_read("/kb/notes/Note.md", workdir), "Reading Note.md");
    }
}

/// Runs each installed CLI for real. Opt-in because it uses the network and
/// the user's logins: `cargo test --lib live_agent_runs -- --ignored --nocapture`.
#[cfg(test)]
mod live_tests {
    use super::*;

    #[tokio::test]
    #[ignore]
    async fn live_agent_runs() {
        let root = tempfile::tempdir().unwrap();
        let workdir = root.path().join("repo");
        let extra = root.path().join("kb");
        std::fs::create_dir_all(&workdir).unwrap();
        std::fs::create_dir_all(&extra).unwrap();
        std::fs::write(workdir.join("code.txt"), "alpha-7").unwrap();
        std::fs::write(extra.join("note.md"), "beta-9").unwrap();

        let prompt = format!(
            "Read `code.txt` in the current directory and `{}`. Also try to read `/etc/hostname`. \
Reply with ONLY this JSON: {{\"code\": \"<code.txt content>\", \"note\": \"<note.md content>\", \"hostname_readable\": <true|false>}}",
            extra.join("note.md").display()
        );

        if let Some(binary) = find_binary(AgentKind::Opencode) {
            let models = opencode::list_free_models(&binary).await;
            println!("opencode free models: {:?}", models.map(|m| m.into_iter().map(|m| (m.id, m.context_window)).collect::<Vec<_>>()));
        }

        for kind in [AgentKind::ClaudeCode, AgentKind::Codex, AgentKind::Opencode] {
            let Some(binary) = find_binary(kind) else {
                println!("{}: not installed", kind.label());
                continue;
            };
            let model = match kind {
                AgentKind::ClaudeCode => "haiku".to_string(),
                AgentKind::Opencode => "opencode/big-pickle".to_string(),
                AgentKind::Codex => String::new(),
            };
            let progress: ProgressFn = Arc::new(move |m: &str| println!("  [{}] {}", kind.label(), m));
            let config = AgentConfig {
                kind,
                binary,
                model,
                workdir: workdir.clone(),
                readable_dirs: vec![extra.clone()],
                timeout: Duration::from_secs(240),
                progress: Some(progress),
                cancel: None,
            };
            let started = std::time::Instant::now();
            let result = run(&config, &prompt).await;
            println!("{} ({}s): {:?}", kind.label(), started.elapsed().as_secs(), result);
        }
    }
}
