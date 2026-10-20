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

const LOG_FORMAT: &str = "--format=%x1e%H%x1f%s%x1f%an%x1f%aI";

/// Lists commits reachable from HEAD, newest first, with diff stats.
pub fn list_commits(repo_path: &str, skip: usize, limit: usize) -> Result<Vec<CommitInfo>, String> {
    run_log(
        repo_path,
        &[format!("--skip={}", skip), format!("--max-count={}", limit)],
    )
}

/// Looks up specific commits by hash. Hashes that no longer exist are skipped.
pub fn get_commits(repo_path: &str, hashes: &[String]) -> Result<Vec<CommitInfo>, String> {
    if hashes.is_empty() {
        return Ok(Vec::new());
    }
    let mut args = vec!["--no-walk".to_string(), "--ignore-missing".to_string()];
    args.extend(hashes.iter().cloned());
    run_log(repo_path, &args)
}

pub fn get_commit(repo_path: &str, hash: &str) -> Result<CommitInfo, String> {
    get_commits(repo_path, &[hash.to_string()])?
        .into_iter()
        .next()
        .ok_or_else(|| format!("Commit not found: {}", hash))
}

fn run_log(repo_path: &str, extra_args: &[String]) -> Result<Vec<CommitInfo>, String> {
    let output = Command::new("git")
        .args(["log", LOG_FORMAT, "--shortstat", "--diff-merges=first-parent"])
        .args(extra_args)
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("Failed to run git log: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git log failed: {}", stderr));
    }

    Ok(parse_log_output(&String::from_utf8_lossy(&output.stdout)))
}

fn parse_log_output(stdout: &str) -> Vec<CommitInfo> {
    stdout
        .split('\x1e')
        .filter_map(|record| {
            let mut lines = record.lines();
            let header = lines.next()?;
            let parts: Vec<&str> = header.splitn(4, '\x1f').collect();
            if parts.len() < 4 {
                return None;
            }
            let stat_line = lines.find(|l| !l.trim().is_empty()).unwrap_or("");
            let (files_changed, additions, deletions) = parse_shortstat(stat_line);
            Some(CommitInfo {
                hash: parts[0].to_string(),
                message: parts[1].to_string(),
                author: parts[2].to_string(),
                timestamp: parts[3].to_string(),
                files_changed,
                additions,
                deletions,
            })
        })
        .collect()
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

#[cfg(test)]
mod tests {
    use super::*;

    fn git(dir: &Path, args: &[&str]) {
        let status = Command::new("git")
            .args(["-c", "user.name=Tester", "-c", "user.email=tester@example.com"])
            .args(args)
            .current_dir(dir)
            .output()
            .unwrap()
            .status;
        assert!(status.success(), "git {:?} failed", args);
    }

    fn repo_with_commits(messages: &[&str]) -> tempfile::TempDir {
        let temp = tempfile::tempdir().unwrap();
        git(temp.path(), &["init", "-q"]);
        for (i, message) in messages.iter().enumerate() {
            std::fs::write(temp.path().join(format!("f{}.txt", i)), "a\nb\n").unwrap();
            git(temp.path(), &["add", "."]);
            git(temp.path(), &["commit", "-q", "-m", message]);
        }
        temp
    }

    #[test]
    fn list_commits_paginates_newest_first_with_stats() {
        let repo = repo_with_commits(&["first", "second | with pipe", "terceiro ção"]);
        let path = repo.path().to_str().unwrap();

        let page = list_commits(path, 0, 2).unwrap();
        assert_eq!(page.len(), 2);
        assert_eq!(page[0].message, "terceiro ção");
        assert_eq!(page[1].message, "second | with pipe");
        assert_eq!(page[1].author, "Tester");
        assert_eq!((page[1].files_changed, page[1].additions, page[1].deletions), (1, 2, 0));

        let rest = list_commits(path, 2, 2).unwrap();
        assert_eq!(rest.len(), 1);
        assert_eq!(rest[0].message, "first");
        assert_eq!(rest[0].files_changed, 1);
    }

    #[test]
    fn get_commits_skips_missing_hashes() {
        let repo = repo_with_commits(&["only"]);
        let path = repo.path().to_str().unwrap();
        let head = list_commits(path, 0, 1).unwrap().remove(0);

        let found = get_commits(path, &[head.hash.clone(), "f".repeat(40)]).unwrap();
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].hash, head.hash);
        assert!(get_commit(path, &"f".repeat(40)).is_err());
    }
}
