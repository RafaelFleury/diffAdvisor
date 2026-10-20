//! End-to-end debrief through a real opencode install. Needs network access:
//!
//!     cargo test --no-default-features --test opencode_e2e -- --ignored --nocapture

use std::path::Path;
use std::process::Command;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use diffadvisor_lib::services::ai::{self, LlmConfig};
use diffadvisor_lib::services::context;
use diffadvisor_lib::services::git;
use diffadvisor_lib::services::opencode::{self, OpencodeConfig};

fn git_in(dir: &Path, args: &[&str]) {
    let ok = Command::new("git")
        .args(["-c", "user.name=Dev", "-c", "user.email=dev@example.com"])
        .args(args)
        .current_dir(dir)
        .status()
        .unwrap()
        .success();
    assert!(ok);
}

#[tokio::test]
#[ignore]
async fn debrief_explores_files_outside_the_diff() {
    let binary = opencode::find_binary().expect("opencode must be installed");
    let model = std::env::var("OPENCODE_MODEL").unwrap_or_else(|_| "opencode/big-pickle".to_string());

    let repo = tempfile::tempdir().unwrap();
    let diffs = tempfile::tempdir().unwrap();
    let dir = repo.path();
    git_in(dir, &["init", "-q"]);
    std::fs::write(
        dir.join("middleware.js"),
        "const rateLimit = require('express-rate-limit')\nmodule.exports = rateLimit({ windowMs: 60000, max: 10 })\n",
    )
    .unwrap();
    git_in(dir, &["add", "."]);
    git_in(dir, &["commit", "-q", "-m", "add rate limit middleware"]);
    std::fs::write(
        dir.join("server.js"),
        "const express = require('express')\nconst limiter = require('./middleware')\nconst app = express()\napp.use(express.json())\napp.post('/login', limiter, (req, res) => res.send(req.body.user))\napp.listen(3000)\n",
    )
    .unwrap();
    git_in(dir, &["add", "."]);
    git_in(dir, &["commit", "-q", "-m", "add login route"]);

    let path = dir.to_str().unwrap();
    let commit = git::list_commits(path, 0, 1, &[]).unwrap().remove(0);
    let diff = git::get_commit_diff(path, &commit.hash).unwrap();
    let diff_file = diffs.path().join("change.diff");
    std::fs::write(&diff_file, &diff).unwrap();

    let progress_log = Arc::new(Mutex::new(Vec::<String>::new()));
    let log = progress_log.clone();
    let config = LlmConfig::Opencode(OpencodeConfig {
        binary,
        model,
        workdir: dir.to_path_buf(),
        readable_dirs: vec![diffs.path().to_path_buf()],
        timeout: Duration::from_secs(600),
        progress: Some(Arc::new(move |m: &str| {
            println!("progress: {}", m);
            log.lock().unwrap().push(m.to_string());
        })),
        cancel: None,
    });

    let system = include_str!("../prompts/system.md");
    let user = context::assemble_agentic_user_message(
        &commit,
        &["server.js".to_string()],
        &[],
        &diff_file.to_string_lossy(),
    );
    let result = ai::run_debrief(&config, system, &user).await.expect("debrief failed");

    println!("{}", serde_json::to_string_pretty(&result.response).unwrap());
    assert!(!result.response.architectural_summary.is_empty());
    let progress = progress_log.lock().unwrap();
    assert!(
        progress.iter().any(|m| m.contains("middleware.js")),
        "agent never looked outside the diff: {:?}",
        progress
    );
}
