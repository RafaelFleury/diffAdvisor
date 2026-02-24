use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitInfo {
    pub hash: String,
    pub message: String,
    pub author: String,
    pub timestamp: String,
    pub files_changed: i32,
    pub additions: i32,
    pub deletions: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileDiff {
    pub file_name: String,
    pub diff: String,
    pub additions: i32,
    pub deletions: i32,
}

pub fn is_git_repo(path: &str) -> bool {
    Path::new(path).join(".git").exists()
}

pub fn list_recent_commits(repo_path: &str, limit: usize) -> Result<Vec<CommitInfo>, String> {
    let output = Command::new("git")
        .args(["log", &format!("-{}", limit), "--format=%H|%s|%an|%aI"])
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("Failed to run git log: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git log failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut commits = Vec::new();

    for line in stdout.lines() {
        let parts: Vec<&str> = line.splitn(4, '|').collect();
        if parts.len() < 4 {
            continue;
        }

        let hash = parts[0].to_string();
        let (files_changed, additions, deletions) = get_commit_stats(repo_path, &hash);

        commits.push(CommitInfo {
            hash,
            message: parts[1].to_string(),
            author: parts[2].to_string(),
            timestamp: parts[3].to_string(),
            files_changed,
            additions,
            deletions,
        });
    }

    Ok(commits)
}

fn get_commit_stats(repo_path: &str, hash: &str) -> (i32, i32, i32) {
    // Try normal diff first (works for non-initial commits)
    let output = Command::new("git")
        .args(["diff", "--shortstat", &format!("{}^..{}", hash, hash)])
        .current_dir(repo_path)
        .output();

    let stat_line = match output {
        Ok(ref o) if o.status.success() => String::from_utf8_lossy(&o.stdout).to_string(),
        _ => {
            // Fallback for initial commit
            let show = Command::new("git")
                .args(["show", "--stat", "--format=", hash])
                .current_dir(repo_path)
                .output();
            match show {
                Ok(ref o) => String::from_utf8_lossy(&o.stdout).to_string(),
                Err(_) => return (0, 0, 0),
            }
        }
    };

    parse_shortstat(&stat_line)
}

fn parse_shortstat(stat: &str) -> (i32, i32, i32) {
    let mut files = 0;
    let mut adds = 0;
    let mut dels = 0;

    for part in stat.split(',') {
        let part = part.trim();
        if part.contains("file") {
            if let Some(n) = part.split_whitespace().next().and_then(|s| s.parse::<i32>().ok()) {
                files = n;
            }
        } else if part.contains("insertion") {
            if let Some(n) = part.split_whitespace().next().and_then(|s| s.parse::<i32>().ok()) {
                adds = n;
            }
        } else if part.contains("deletion") {
            if let Some(n) = part.split_whitespace().next().and_then(|s| s.parse::<i32>().ok()) {
                dels = n;
            }
        }
    }

    (files, adds, dels)
}

pub fn get_commit_diff(repo_path: &str, commit_hash: &str) -> Result<String, String> {
    // Try normal diff first
    let output = Command::new("git")
        .args(["diff", &format!("{}^..{}", commit_hash, commit_hash)])
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("Failed to run git diff: {}", e))?;

    if output.status.success() && !output.stdout.is_empty() {
        return Ok(String::from_utf8_lossy(&output.stdout).to_string());
    }

    // Fallback for initial commit
    let output = Command::new("git")
        .args(["show", commit_hash])
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("Failed to run git show: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git show failed: {}", stderr));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

pub fn detect_project_language(repo_path: &str) -> (String, Vec<String>) {
    let path = Path::new(repo_path);
    let mut language = String::new();
    let mut frameworks = Vec::new();

    // Check package.json
    if let Ok(content) = std::fs::read_to_string(path.join("package.json")) {
        if content.contains("\"next\"") {
            language = "TypeScript".to_string();
            frameworks.push("Next.js".to_string());
        } else if content.contains("\"react\"") {
            frameworks.push("React".to_string());
        }
        if content.contains("\"express\"") {
            frameworks.push("Express".to_string());
        }
        if content.contains("\"vue\"") {
            frameworks.push("Vue".to_string());
        }
        if content.contains("\"typescript\"") || path.join("tsconfig.json").exists() {
            language = "TypeScript".to_string();
        } else if language.is_empty() {
            language = "JavaScript".to_string();
        }
    }

    // Check Python
    if path.join("requirements.txt").exists() || path.join("pyproject.toml").exists() {
        if language.is_empty() {
            language = "Python".to_string();
        }
        if let Ok(content) = std::fs::read_to_string(path.join("requirements.txt")) {
            if content.contains("django") {
                frameworks.push("Django".to_string());
            }
            if content.contains("flask") {
                frameworks.push("Flask".to_string());
            }
            if content.contains("fastapi") {
                frameworks.push("FastAPI".to_string());
            }
        }
    }

    // Check Rust
    if path.join("Cargo.toml").exists() {
        if language.is_empty() {
            language = "Rust".to_string();
        }
        if let Ok(content) = std::fs::read_to_string(path.join("Cargo.toml")) {
            if content.contains("actix") {
                frameworks.push("Actix".to_string());
            }
            if content.contains("tauri") {
                frameworks.push("Tauri".to_string());
            }
        }
    }

    // Check Go
    if path.join("go.mod").exists() {
        if language.is_empty() {
            language = "Go".to_string();
        }
    }

    // Check Java
    if path.join("pom.xml").exists() || path.join("build.gradle").exists() {
        if language.is_empty() {
            language = "Java".to_string();
        }
        if path.join("pom.xml").exists() {
            if let Ok(content) = std::fs::read_to_string(path.join("pom.xml")) {
                if content.contains("spring") {
                    frameworks.push("Spring".to_string());
                }
            }
        }
    }

    if language.is_empty() {
        language = "Unknown".to_string();
    }

    (language, frameworks)
}

pub fn parse_diff_to_file_diffs(diff: &str) -> Vec<FileDiff> {
    let mut file_diffs = Vec::new();
    let chunks: Vec<&str> = diff.split("diff --git ").collect();

    for chunk in chunks.iter().skip(1) {
        let lines: Vec<&str> = chunk.lines().collect();
        if lines.is_empty() {
            continue;
        }

        // Extract file name from "a/path b/path"
        let file_name = lines[0]
            .split(" b/")
            .last()
            .unwrap_or("unknown")
            .to_string();

        let mut additions = 0;
        let mut deletions = 0;

        for line in &lines {
            if line.starts_with('+') && !line.starts_with("+++") {
                additions += 1;
            } else if line.starts_with('-') && !line.starts_with("---") {
                deletions += 1;
            }
        }

        let diff_content = format!("diff --git {}", chunk);

        file_diffs.push(FileDiff {
            file_name,
            diff: diff_content,
            additions,
            deletions,
        });
    }

    file_diffs
}
