use super::git::CommitInfo;
use super::skills::Skill;
use std::fs;
use std::path::Path;

pub struct AssembledContext {
    pub system_message: String,
    pub user_message: String,
    pub active_skills: Vec<String>,
    pub context_reduction_log: Vec<String>,
}

pub fn estimate_tokens(text: &str, is_code: bool) -> usize {
    let chars = text.len() as f64;
    if is_code {
        (chars / 3.5) as usize
    } else {
        (chars / 4.0) as usize
    }
}

pub fn build_project_structure(repo_path: &str, ignored_paths: &[&str]) -> String {
    let mut result = String::new();
    let root = Path::new(repo_path);
    let mut entries_count = 0;
    build_tree(root, "", 0, 3, ignored_paths, &mut result, &mut entries_count);
    result
}

fn build_tree(
    dir: &Path,
    prefix: &str,
    depth: usize,
    max_depth: usize,
    ignored: &[&str],
    result: &mut String,
    count: &mut usize,
) {
    if depth > max_depth || *count >= 100 {
        return;
    }

    let mut entries: Vec<_> = match fs::read_dir(dir) {
        Ok(rd) => rd.filter_map(|e| e.ok()).collect(),
        Err(_) => return,
    };

    entries.sort_by_key(|e| e.file_name());

    let total = entries.len();
    for (i, entry) in entries.iter().enumerate() {
        if *count >= 100 {
            return;
        }

        let name = entry.file_name();
        let name_str = name.to_string_lossy();

        if ignored.iter().any(|ig| name_str == *ig) {
            continue;
        }

        let is_last = i == total - 1;
        let connector = if is_last { "\u{2514}\u{2500}\u{2500} " } else { "\u{251c}\u{2500}\u{2500} " };
        let child_prefix = if is_last { "    " } else { "\u{2502}   " };

        result.push_str(&format!("{}{}{}\n", prefix, connector, name_str));
        *count += 1;

        if entry.path().is_dir() {
            build_tree(
                &entry.path(),
                &format!("{}{}", prefix, child_prefix),
                depth + 1,
                max_depth,
                ignored,
                result,
                count,
            );
        }
    }
}

pub fn assemble_system_message(
    base_prompt: &str,
    analysis_depth: &str,
    checkpoint_mode: &str,
    manual_skills: &[&Skill],
    auto_skills: &[(Skill, u32)],
    token_budget: usize,
) -> (String, Vec<String>) {
    let mut message = base_prompt.to_string();
    let mut skills_used = Vec::new();

    // Add depth instructions
    match analysis_depth {
        "quick" => {
            message.push_str("\n\n## Analysis Depth: Quick\nProvide concise feedback. 1-2 checkpoint questions. Focus on critical gaps only.");
        }
        "deep" => {
            message.push_str("\n\n## Analysis Depth: Deep\nProvide thorough, detailed feedback. 3 checkpoint questions. Cover all gap categories.");
        }
        _ => {
            // balanced - default behavior, no extra instruction needed
        }
    }

    // Add checkpoint mode instructions
    match checkpoint_mode {
        "multiple_choice" => {
            message.push_str("\n\n## Checkpoint Format\nGenerate multiple-choice checkpoint questions. Each question must include:\n- \"options\": array of 4 option strings\n- \"correct_option_index\": integer (0-3) indicating the correct answer\n");
        }
        _ => {
            // free_text - default, handled by base prompt
        }
    }

    // Add skills
    let mut skill_blocks = Vec::new();

    // Manual skills first (always included)
    for skill in manual_skills {
        skill_blocks.push((skill.name.clone(), skill.content.clone(), u32::MAX));
        skills_used.push(skill.name.clone());
    }

    // Auto-detected skills (sorted by relevance, may be dropped if over budget)
    for (skill, relevance) in auto_skills {
        // Skip if already included as manual
        if skills_used.contains(&skill.name) {
            continue;
        }
        skill_blocks.push((skill.name.clone(), skill.content.clone(), *relevance));
    }

    if !skill_blocks.is_empty() {
        message.push_str("\n\n## Active Skills\n");

        let mut current_tokens = estimate_tokens(&message, false);

        for (name, content, _relevance) in &skill_blocks {
            let skill_block = format!("\n### Skill: {}\n{}\n", name, content);
            let block_tokens = estimate_tokens(&skill_block, false);

            if current_tokens + block_tokens > token_budget {
                break;
            }

            message.push_str(&skill_block);
            current_tokens += block_tokens;
            if !skills_used.contains(name) {
                skills_used.push(name.clone());
            }
        }
    }

    (message, skills_used)
}

pub fn format_history_line(commit_hash: &str, commit_message: &str, gaps: &[String]) -> String {
    let short_hash = &commit_hash[..7.min(commit_hash.len())];
    if gaps.is_empty() {
        format!("[{}] {}", short_hash, commit_message)
    } else {
        format!("[{}] {} \u{2014} gaps: {}", short_hash, commit_message, gaps.join(", "))
    }
}

pub fn assemble_user_message(
    project_structure: &str,
    commit: &CommitInfo,
    history: &[String],
    diff: &str,
    system_tokens_used: usize,
) -> (String, Vec<String>) {
    let total_budget: usize = 100_000;
    let remaining = total_budget.saturating_sub(system_tokens_used);
    let mut reduction_log = Vec::new();

    let mut parts = Vec::new();

    // Project structure
    let structure_section = format!("## Project Structure\n```\n{}\n```\n", project_structure);

    // Commit info
    let commit_section = format!(
        "## Commit\nHash: {}\nMessage: {}\nAuthor: {}\nDate: {}\nFiles changed: {} (+{} -{})\n",
        commit.hash, commit.message, commit.author, commit.timestamp,
        commit.files_changed, commit.additions, commit.deletions
    );

    // History
    let history_section = if !history.is_empty() {
        format!("## Recent History\n{}\n", history.join("\n"))
    } else {
        String::new()
    };

    // Diff
    let diff_section = format!("## Diff\n```diff\n{}\n```\n", diff);

    // Calculate tokens
    let commit_tokens = estimate_tokens(&commit_section, false);
    let structure_tokens = estimate_tokens(&structure_section, false);
    let history_tokens = estimate_tokens(&history_section, false);
    let diff_tokens = estimate_tokens(&diff_section, true);

    let total_tokens = commit_tokens + structure_tokens + history_tokens + diff_tokens;

    if total_tokens <= remaining {
        // Everything fits
        parts.push(structure_section);
        parts.push(commit_section);
        if !history_section.is_empty() {
            parts.push(history_section);
        }
        parts.push(diff_section);
    } else {
        // Overflow cascade
        let budget = remaining - commit_tokens; // commit info always included
        parts.push(commit_section);

        // 1. Try to fit everything
        if structure_tokens + history_tokens + diff_tokens <= budget {
            parts.push(structure_section);
            if !history_section.is_empty() {
                parts.push(history_section);
            }
            parts.push(diff_section);
        }
        // 2. Drop history
        else if structure_tokens + diff_tokens <= budget {
            reduction_log.push("Dropped commit history to fit context budget".to_string());
            parts.push(structure_section);
            let (truncated_diff, diff_log) = truncate_diff_smart(diff, budget - structure_tokens);
            parts.push(format!("## Diff\n```diff\n{}\n```\n", truncated_diff));
            reduction_log.extend(diff_log);
        }
        // 3. Drop history + reduce diff
        else if diff_tokens <= budget {
            reduction_log.push("Dropped commit history to fit context budget".to_string());
            reduction_log.push("Dropped project structure to fit context budget".to_string());
            parts.push(diff_section);
        }
        // 4. Drop everything except truncated diff
        else {
            reduction_log.push("Dropped commit history to fit context budget".to_string());
            reduction_log.push("Dropped project structure to fit context budget".to_string());
            let (truncated_diff, diff_log) = truncate_diff_smart(diff, budget);
            parts.push(format!("## Diff\n```diff\n{}\n```\n", truncated_diff));
            reduction_log.extend(diff_log);
        }
    }

    (parts.join("\n"), reduction_log)
}

pub fn truncate_diff_smart(diff: &str, token_budget: usize) -> (String, Vec<String>) {
    let mut log = Vec::new();

    // Exclude lock/minified files
    let excluded_patterns = [
        "package-lock.json",
        "yarn.lock",
        "Cargo.lock",
        "pnpm-lock.yaml",
        ".min.js",
        ".min.css",
    ];

    let file_chunks: Vec<&str> = diff.split("diff --git ").collect();
    let mut kept_chunks: Vec<String> = Vec::new();
    let mut current_tokens: usize = 0;

    // Priority tiers for file ordering
    fn file_priority(name: &str) -> u8 {
        let lower = name.to_lowercase();
        if lower.contains("auth") || lower.contains("security") || lower.contains("crypto") {
            return 0;
        }
        if lower.contains("config") || lower.contains("deploy") || lower.contains("docker") || lower.contains("ci") {
            return 1;
        }
        if lower.contains("api") || lower.contains("route") || lower.contains("endpoint") || lower.contains("controller") {
            return 2;
        }
        if lower.contains("model") || lower.contains("schema") || lower.contains("migration") || lower.contains("db") {
            return 3;
        }
        4
    }

    let mut prioritized: Vec<(u8, &str)> = Vec::new();
    for chunk in file_chunks.iter().skip(1) {
        let first_line = chunk.lines().next().unwrap_or("");
        let file_name = first_line.split(" b/").last().unwrap_or("");

        // Skip excluded files
        if excluded_patterns.iter().any(|p| file_name.contains(p)) {
            log.push(format!("Excluded lock/minified file: {}", file_name));
            continue;
        }

        // Skip files with very long lines (likely binary/minified)
        if chunk.lines().any(|l| l.len() > 500) {
            log.push(format!("Excluded likely binary/minified file: {}", file_name));
            continue;
        }

        let priority = file_priority(file_name);
        prioritized.push((priority, chunk));
    }

    prioritized.sort_by_key(|(p, _)| *p);

    for (_priority, chunk) in prioritized {
        let full_chunk = format!("diff --git {}", chunk);
        let chunk_tokens = estimate_tokens(&full_chunk, true);

        if current_tokens + chunk_tokens <= token_budget {
            kept_chunks.push(full_chunk);
            current_tokens += chunk_tokens;
        } else {
            // Try to keep first+last 100 lines with middle omitted
            let lines: Vec<&str> = full_chunk.lines().collect();
            if lines.len() > 200 {
                let omitted_msg = format!("[--- {} lines omitted ---]", lines.len() - 200);
                let mut truncated: Vec<&str> = Vec::new();
                truncated.extend_from_slice(&lines[..100]);
                truncated.push(&omitted_msg);
                truncated.extend_from_slice(&lines[lines.len() - 100..]);
                let truncated_str = truncated.join("\n");
                let trunc_tokens = estimate_tokens(&truncated_str, true);

                if current_tokens + trunc_tokens <= token_budget {
                    kept_chunks.push(truncated_str);
                    current_tokens += trunc_tokens;
                    log.push(format!(
                        "Truncated large diff: kept first/last 100 lines, omitted {} lines",
                        lines.len() - 200
                    ));
                } else {
                    let file_name = lines[0].split(" b/").last().unwrap_or("unknown");
                    log.push(format!("Dropped file from diff: {}", file_name));
                }
            } else {
                let file_name = lines.first().and_then(|l| l.split(" b/").last()).unwrap_or("unknown");
                log.push(format!("Dropped file from diff: {}", file_name));
            }
        }
    }

    (kept_chunks.join("\n"), log)
}
