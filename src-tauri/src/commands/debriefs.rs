use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, State};

use crate::db::models::{Debrief, Gap};
use crate::services::{ai, context, git, skills};
use crate::state::AppState;

use super::llm;

const DEBRIEF_TIMEOUT: Duration = Duration::from_secs(20 * 60);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DebriefProgressEvent {
    commit_hash: String,
    message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DebriefDto {
    pub id: String,
    pub commit_hash: String,
    pub commit_message: String,
    pub architectural_summary: String,
    pub patterns_identified: Vec<String>,
    pub decisions_made: Vec<ai::Decision>,
    pub gaps: Vec<GapDto>,
    pub checkpoint_questions: Vec<CheckpointQuestionDto>,
    pub knowledge_base_notes: Vec<ai::SuggestedNote>,
    pub skills_used: Vec<String>,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GapDto {
    pub id: String,
    pub severity: String,
    pub category: String,
    pub description: String,
    pub explanation: String,
    pub suggestion: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckpointQuestionDto {
    pub id: String,
    pub question: String,
    pub concept: String,
    pub good_answer_includes: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub correct_option_index: Option<u32>,
}

const DEFAULT_COMMIT_PAGE_SIZE: usize = 50;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingCommitsDto {
    pub commits: Vec<CommitDto>,
    pub has_more: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitDto {
    pub hash: String,
    pub message: String,
    pub author: String,
    pub timestamp: String,
    pub files_changed: i32,
    pub additions: i32,
    pub deletions: i32,
    pub status: String,
}

fn commit_info_to_dto(ci: &git::CommitInfo, status: &str) -> CommitDto {
    CommitDto {
        hash: ci.hash.clone(),
        message: ci.message.clone(),
        author: ci.author.clone(),
        timestamp: ci.timestamp.clone(),
        files_changed: ci.files_changed,
        additions: ci.additions,
        deletions: ci.deletions,
        status: status.to_string(),
    }
}

fn debrief_to_dto(debrief: &Debrief, gaps: &[Gap]) -> DebriefDto {
    let ai_response: Option<ai::DebriefResponse> = debrief
        .ai_response_json
        .as_ref()
        .and_then(|json| serde_json::from_str(json).ok());

    let gap_dtos: Vec<GapDto> = gaps
        .iter()
        .map(|g| GapDto {
            id: g.id.to_string(),
            severity: g.severity.clone(),
            category: g.category.clone(),
            description: g.description.clone(),
            explanation: g.explanation.clone(),
            suggestion: g.suggestion.clone(),
        })
        .collect();

    DebriefDto {
        id: debrief.id.to_string(),
        commit_hash: debrief.commit_hash.clone(),
        commit_message: debrief.commit_message.clone(),
        architectural_summary: ai_response
            .as_ref()
            .map(|r| r.architectural_summary.clone())
            .unwrap_or_default(),
        patterns_identified: ai_response
            .as_ref()
            .map(|r| r.patterns_identified.clone())
            .unwrap_or_default(),
        decisions_made: ai_response
            .as_ref()
            .map(|r| r.decisions_made.clone())
            .unwrap_or_default(),
        gaps: gap_dtos,
        checkpoint_questions: ai_response
            .as_ref()
            .map(|r| {
                r.checkpoint_questions
                    .iter()
                    .enumerate()
                    .map(|(i, q)| CheckpointQuestionDto {
                        id: format!("q{}", i),
                        question: q.question.clone(),
                        concept: q.concept.clone(),
                        good_answer_includes: q.good_answer_includes.clone(),
                        options: q.options.clone(),
                        correct_option_index: q.correct_option_index,
                    })
                    .collect()
            })
            .unwrap_or_default(),
        knowledge_base_notes: ai_response
            .as_ref()
            .map(|r| r.suggested_notes.clone())
            .unwrap_or_default(),
        skills_used: debrief.skills_used.clone(),
        status: debrief.status.clone(),
        created_at: debrief.created_at.clone(),
    }
}


#[tauri::command]
pub async fn get_pending_commits(
    state: State<'_, AppState>,
    project_id: i64,
    limit: Option<usize>,
) -> Result<PendingCommitsDto, String> {
    let limit = limit.unwrap_or(DEFAULT_COMMIT_PAGE_SIZE);
    let (project_path, reviewed_hashes, only_my_commits, extra_author_emails) = {
        let db = state.db();
        let project = db
            .get_project(project_id)
            .map_err(|e| format!("Project not found: {}", e))?;
        let reviewed_hashes: Vec<String> = db
            .list_debriefs_by_status(project_id, "reviewed")
            .map_err(|e| format!("Failed to list debriefs: {}", e))?
            .into_iter()
            .map(|d| d.commit_hash)
            .collect();
        let only_my_commits = db.get_setting("project.onlyMyCommits").ok().flatten().as_deref() != Some("false");
        let extra_author_emails = db.get_setting("project.extraAuthorEmails").ok().flatten().unwrap_or_default();
        (project.path, reviewed_hashes, only_my_commits, extra_author_emails)
    };

    let author_emails: Vec<String> = if only_my_commits {
        git::local_user_email(&project_path)
            .into_iter()
            .chain(
                extra_author_emails
                    .split(',')
                    .map(|e| e.trim().to_string())
                    .filter(|e| !e.is_empty()),
            )
            .collect()
    } else {
        Vec::new()
    };

    let mut commits = git::list_commits(&project_path, 0, limit + 1, &author_emails)?;
    let has_more = commits.len() > limit;
    commits.truncate(limit);

    let pending = commits
        .iter()
        .filter(|c| !reviewed_hashes.contains(&c.hash))
        .map(|c| commit_info_to_dto(c, "pending"))
        .collect();

    Ok(PendingCommitsDto {
        commits: pending,
        has_more,
    })
}

#[tauri::command]
pub async fn get_reviewed_commits(
    state: State<'_, AppState>,
    project_id: i64,
) -> Result<Vec<CommitDto>, String> {
    let (project_path, reviewed_debriefs) = {
        let db = state.db();
        let project = db
            .get_project(project_id)
            .map_err(|e| format!("Project not found: {}", e))?;
        let reviewed_debriefs = db
            .list_debriefs_by_status(project_id, "reviewed")
            .map_err(|e| format!("Failed to list debriefs: {}", e))?;
        (project.path, reviewed_debriefs)
    };

    let hashes: Vec<String> = reviewed_debriefs.iter().map(|d| d.commit_hash.clone()).collect();
    let known = git::get_commits(&project_path, &hashes).unwrap_or_default();

    let commits = reviewed_debriefs
        .into_iter()
        .map(|debrief| match known.iter().find(|c| c.hash == debrief.commit_hash) {
            Some(ci) => commit_info_to_dto(ci, "reviewed"),
            None => CommitDto {
                hash: debrief.commit_hash,
                message: debrief.commit_message,
                author: String::new(),
                timestamp: debrief.created_at,
                files_changed: 0,
                additions: 0,
                deletions: 0,
                status: "reviewed".to_string(),
            },
        })
        .collect();

    Ok(commits)
}

#[tauri::command]
pub async fn get_debrief_by_commit(
    state: State<'_, AppState>,
    project_id: i64,
    commit_hash: String,
) -> Result<Option<DebriefDto>, String> {
    let db = state.db();
    let debrief = db
        .get_debrief_by_commit(project_id, &commit_hash)
        .map_err(|e| format!("Failed to get debrief: {}", e))?;

    match debrief {
        Some(d) => {
            let gaps = db
                .get_gaps_by_debrief(d.id)
                .map_err(|e| format!("Failed to get gaps: {}", e))?;
            Ok(Some(debrief_to_dto(&d, &gaps)))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub async fn run_debrief(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    project_id: i64,
    commit_hash: String,
) -> Result<DebriefDto, String> {
    let flow_start = Instant::now();
    eprintln!(
        "[debrief] run_debrief started project_id={} commit_hash={}",
        project_id, commit_hash
    );

    // 1. Check if debrief already exists
    {
        let db = state.db();
        if let Ok(Some(existing)) = db.get_debrief_by_commit(project_id, &commit_hash) {
            eprintln!(
                "[debrief] existing debrief found in cache debrief_id={} commit_hash={}",
                existing.id, existing.commit_hash
            );
            let gaps = db.get_gaps_by_debrief(existing.id).unwrap_or_default();
            eprintln!(
                "[debrief] run_debrief completed from cache gap_count={} total_elapsed_ms={}",
                gaps.len(),
                flow_start.elapsed().as_millis()
            );
            return Ok(debrief_to_dto(&existing, &gaps));
        }
    }

    // 2. Get project info
    let (project_path, project_active_skills) = {
        let db = state.db();
        let project = db
            .get_project(project_id)
            .map_err(|e| format!("Project not found: {}", e))?;
        (project.path.clone(), project.active_skills.clone())
    };
    eprintln!(
        "[debrief] project context loaded path={} active_skills={}",
        project_path,
        project_active_skills.len()
    );

    // 3. Get settings
    let (analysis_depth, checkpoint_mode, ignored_paths_str, context_window) = {
        let db = state.db();
        let depth = db.get_setting("analysis.analysisDepth").ok().flatten().unwrap_or_else(|| "balanced".to_string());
        let mode = db.get_setting("analysis.checkpointMode").ok().flatten().unwrap_or_else(|| "free_text".to_string());
        let ignored = db.get_setting("project.ignoredPaths").ok().flatten().unwrap_or_default();
        let context_window = db
            .get_setting("ai.contextWindow")
            .ok()
            .flatten()
            .and_then(|v| v.trim().parse::<usize>().ok())
            .unwrap_or(128_000);

        (depth, mode, ignored, context_window)
    };

    let diffs_dir = llm::agent_dir("diffs")?;
    let kb_root = Some(super::knowledge::get_kb_root(&state)).filter(|dir| dir.is_dir());
    let mut readable_dirs = vec![diffs_dir.clone()];
    readable_dirs.extend(kb_root.clone());
    let mut llm_config = llm::load_llm_config(
        &state,
        Some(Path::new(&project_path)),
        readable_dirs,
        DEBRIEF_TIMEOUT,
    )
    .await?;
    if let ai::LlmConfig::Agent(ref mut agent_config) = llm_config {
        let handle = app_handle.clone();
        let hash = commit_hash.clone();
        agent_config.progress = Some(Arc::new(move |message: &str| {
            let _ = handle.emit(
                "debrief_progress",
                DebriefProgressEvent {
                    commit_hash: hash.clone(),
                    message: message.to_string(),
                },
            );
        }));
    }
    eprintln!(
        "[debrief] settings loaded llm={} analysis_depth={} checkpoint_mode={}",
        llm_config.describe(),
        analysis_depth,
        checkpoint_mode
    );

    // 4. Get commit diff
    let diff_step_start = Instant::now();
    let diff = git::get_commit_diff(&project_path, &commit_hash)?;
    let commit_info = git::get_commit(&project_path, &commit_hash)?;

    let file_diffs = git::parse_diff_to_file_diffs(&diff);
    let changed_files: Vec<String> = file_diffs.iter().map(|f| f.file_name.clone()).collect();
    eprintln!(
        "[debrief] commit diff loaded commit_hash={} files={} diff_bytes={} elapsed_ms={}",
        commit_hash,
        file_diffs.len(),
        diff.len(),
        diff_step_start.elapsed().as_millis()
    );

    // 5. Load and detect skills
    let all_skills = skills::load_all_skills().unwrap_or_default();

    let manual_skills: Vec<&skills::Skill> = all_skills
        .iter()
        .filter(|s| project_active_skills.contains(&s.id))
        .collect();

    let auto_skills = skills::detect_skills_for_diff(
        &all_skills,
        &diff,
        &commit_info.message,
        &changed_files,
    );
    eprintln!(
        "[debrief] skills resolved manual={} auto={} total_available={}",
        manual_skills.len(),
        auto_skills.len(),
        all_skills.len()
    );

    // 6. Build context
    let ignored_paths: Vec<&str> = ignored_paths_str.split(',').map(|s| s.trim()).collect();
    let project_structure = context::build_project_structure(&project_path, &ignored_paths);

    // Get history (depth-based limits)
    let history_limit = match analysis_depth.as_str() {
        "quick" => 0,
        "deep" => 5,
        _ => 3, // balanced
    };

    let history: Vec<String> = {
        let db = state.db();
        let recent_debriefs = db
            .list_debriefs_by_status(project_id, "reviewed")
            .unwrap_or_default();

        recent_debriefs
            .iter()
            .take(history_limit)
            .map(|d| {
                let gap_descriptions: Vec<String> = db
                    .get_gaps_by_debrief(d.id)
                    .unwrap_or_default()
                    .iter()
                    .map(|g| g.description.clone())
                    .collect();
                context::format_history_line(&d.commit_hash, &d.commit_message, &gap_descriptions)
            })
            .collect()
    };

    // Get base system prompt
    let base_prompt = {
        let db = state.db();
        db.get_setting("system.prompt")
            .ok()
            .flatten()
            .unwrap_or_else(|| default_system_prompt().to_string())
    };

    let input_budget = context::input_token_budget(context_window);
    let (system_message, skills_used) = context::assemble_system_message(
        &base_prompt,
        &analysis_depth,
        &checkpoint_mode,
        &manual_skills,
        &auto_skills,
        input_budget / 2,
    );

    let system_tokens = context::estimate_tokens(&system_message, false);
    // Agentic backends read the diff from a file and explore the repo themselves;
    // the API path still needs everything inlined and trimmed to the budget.
    let diff_file = diffs_dir.join(format!("{}.diff", commit_hash));
    let (user_message, reduction_log) = if llm_config.is_agentic() {
        std::fs::write(&diff_file, &diff).map_err(|e| format!("Failed to write diff file: {}", e))?;
        let message = context::assemble_agentic_user_message(
            &commit_info,
            &changed_files,
            &history,
            &diff_file.to_string_lossy(),
            kb_root.as_deref().map(|dir| dir.to_str().unwrap_or_default()),
        );
        (message, Vec::new())
    } else {
        context::assemble_user_message(
            &project_structure,
            &commit_info,
            &history,
            &diff,
            system_tokens,
            input_budget,
        )
    };
    eprintln!(
        "[debrief] prompt context assembled system_tokens={} user_chars={} history_items={} reductions={}",
        system_tokens,
        user_message.len(),
        history.len(),
        reduction_log.len()
    );

    // 7. Call AI
    let llm_step_start = Instant::now();
    eprintln!(
        "[debrief] calling LLM {} commit_hash={}",
        llm_config.describe(),
        commit_hash
    );
    // Seed the prompt with notes the developer already has on these topics,
    // found by plain keyword search over the knowledge base index.
    let added_lines: String = diff
        .lines()
        .filter(|l| l.starts_with('+') && !l.starts_with("+++"))
        .collect::<Vec<_>>()
        .join("\n");
    let search_text = format!(
        "{msg}\n{msg}\n{files}\n{added}",
        msg = commit_info.message,
        files = changed_files.join(" "),
        added = added_lines
    );
    let related = super::knowledge::find_related_notes(
        &state,
        &crate::services::knowledge::extract_search_terms(&search_text, 25),
        None,
        5,
    );
    let user_message = if related.is_empty() {
        user_message
    } else {
        // Before the task text, so the closing "reply with JSON" instruction stays last.
        format!("{}\n{}", crate::services::knowledge::format_related_notes(&related), user_message)
    };
    eprintln!("[debrief] related KB notes found={}", related.len());

    let debrief_outcome = ai::run_debrief(&llm_config, &system_message, &user_message).await;
    let _ = std::fs::remove_file(&diff_file);
    let debrief_result = match debrief_outcome {
        Ok(result) => {
            eprintln!(
                "[debrief] LLM response received elapsed_ms={}",
                llm_step_start.elapsed().as_millis()
            );
            result
        }
        Err(e) => {
            eprintln!(
                "[debrief] LLM call failed elapsed_ms={} error={}",
                llm_step_start.elapsed().as_millis(),
                e
            );
            return Err(format!("AI debrief failed: {}", e));
        }
    };

    let ai_response = debrief_result.response;
    eprintln!(
        "[debrief] LLM response parsed gaps={} questions={} notes={}",
        ai_response.gaps.len(),
        ai_response.checkpoint_questions.len(),
        ai_response.suggested_notes.len()
    );

    // Serialize AI response and embed context_reduction_log
    let ai_response_json = {
        let mut json_val = serde_json::to_value(&ai_response)
            .map_err(|e| format!("Failed to serialize AI response: {}", e))?;
        if !reduction_log.is_empty() {
            if let Some(obj) = json_val.as_object_mut() {
                obj.insert(
                    "contextReductionLog".to_string(),
                    serde_json::json!(reduction_log),
                );
            }
        }
        serde_json::to_string(&json_val)
            .map_err(|e| format!("Failed to serialize AI response: {}", e))?
    };

    // 8. Save to DB
    let db = state.db();

    // Persist discovered output cap so future calls skip the wasted first request
    if let Some(ref cap) = debrief_result.discovered_output_cap {
        let _ = db.set_setting("ai.requiresOutputCap", cap);
    }

    let debrief = db
        .create_debrief(
            project_id,
            &commit_hash,
            &commit_info.message,
            &diff,
            Some(&ai_response_json),
            &skills_used,
        )
        .map_err(|e| format!("Failed to create debrief: {}", e))?;

    // Create gaps
    let gap_tuples: Vec<(&str, &str, &str, &str, &str)> = ai_response
        .gaps
        .iter()
        .map(|g| {
            (
                g.severity.as_str(),
                g.category.as_str(),
                g.description.as_str(),
                g.explanation.as_str(),
                g.suggestion.as_str(),
            )
        })
        .collect();

    let gaps = db
        .create_gaps(debrief.id, &gap_tuples)
        .map_err(|e| format!("Failed to create gaps: {}", e))?;

    // Update last analyzed
    let _ = db.update_project_last_analyzed(project_id);

    // 9. Return DTO
    eprintln!(
        "[debrief] run_debrief completed debrief_id={} gap_count={} total_elapsed_ms={}",
        debrief.id,
        gaps.len(),
        flow_start.elapsed().as_millis()
    );
    Ok(debrief_to_dto(&debrief, &gaps))
}

#[tauri::command]
pub async fn get_diff_content(
    state: State<'_, AppState>,
    project_id: i64,
    commit_hash: String,
) -> Result<Vec<git::FileDiff>, String> {
    let started_at = Instant::now();
    eprintln!(
        "[debrief] get_diff_content started project_id={} commit_hash={}",
        project_id, commit_hash
    );
    let db = state.db();
    let project = db
        .get_project(project_id)
        .map_err(|e| format!("Project not found: {}", e))?;

    let diff = git::get_commit_diff(&project.path, &commit_hash)?;
    let files = git::parse_diff_to_file_diffs(&diff);
    eprintln!(
        "[debrief] get_diff_content completed commit_hash={} files={} diff_bytes={} elapsed_ms={}",
        commit_hash,
        files.len(),
        diff.len(),
        started_at.elapsed().as_millis()
    );
    Ok(files)
}

#[tauri::command]
pub async fn mark_reviewed(state: State<'_, AppState>, debrief_id: i64) -> Result<(), String> {
    let db = state.db();
    db.mark_debrief_reviewed(debrief_id)
        .map_err(|e| format!("Failed to mark reviewed: {}", e))
}

#[tauri::command]
pub async fn get_gap_count(state: State<'_, AppState>, project_id: i64) -> Result<i64, String> {
    let db = state.db();
    db.count_gaps_by_project(project_id)
        .map_err(|e| format!("Failed to count gaps: {}", e))
}

fn default_system_prompt() -> &'static str {
    include_str!("../../prompts/system.md")
}
