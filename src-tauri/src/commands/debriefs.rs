use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::models::{Debrief, Gap};
use crate::services::{ai, context, git, skills};
use crate::state::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DebriefDto {
    pub id: i64,
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
        id: debrief.id,
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
) -> Result<Vec<git::CommitInfo>, String> {
    let db = state.db();
    let project = db
        .get_project(project_id)
        .map_err(|e| format!("Project not found: {}", e))?;

    let all_commits = git::list_recent_commits(&project.path, 50)?;

    // Get reviewed debrief commit hashes
    let reviewed_debriefs = db
        .list_debriefs_by_status(project_id, "reviewed")
        .map_err(|e| format!("Failed to list debriefs: {}", e))?;
    let reviewed_hashes: Vec<String> = reviewed_debriefs.iter().map(|d| d.commit_hash.clone()).collect();

    let pending: Vec<git::CommitInfo> = all_commits
        .into_iter()
        .filter(|c| !reviewed_hashes.contains(&c.hash))
        .collect();

    Ok(pending)
}

#[tauri::command]
pub async fn get_reviewed_commits(
    state: State<'_, AppState>,
    project_id: i64,
) -> Result<Vec<git::CommitInfo>, String> {
    let db = state.db();
    let project = db
        .get_project(project_id)
        .map_err(|e| format!("Project not found: {}", e))?;

    let reviewed_debriefs = db
        .list_debriefs_by_status(project_id, "reviewed")
        .map_err(|e| format!("Failed to list debriefs: {}", e))?;

    let mut commits = Vec::new();
    for debrief in reviewed_debriefs {
        // Try to get commit info from git
        let recent = git::list_recent_commits(&project.path, 100).unwrap_or_default();
        if let Some(ci) = recent.into_iter().find(|c| c.hash == debrief.commit_hash) {
            commits.push(ci);
        } else {
            commits.push(git::CommitInfo {
                hash: debrief.commit_hash,
                message: debrief.commit_message,
                author: String::new(),
                timestamp: debrief.created_at,
                files_changed: 0,
                additions: 0,
                deletions: 0,
            });
        }
    }

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
    state: State<'_, AppState>,
    project_id: i64,
    commit_hash: String,
) -> Result<DebriefDto, String> {
    // 1. Check if debrief already exists
    {
        let db = state.db();
        if let Ok(Some(existing)) = db.get_debrief_by_commit(project_id, &commit_hash) {
            let gaps = db.get_gaps_by_debrief(existing.id).unwrap_or_default();
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

    // 3. Get settings
    let (ai_config, analysis_depth, checkpoint_mode, ignored_paths_str) = {
        let db = state.db();
        let endpoint = db.get_setting("ai.endpointUrl").ok().flatten().unwrap_or_default();
        let model = db.get_setting("ai.model").ok().flatten().unwrap_or_default();
        let api_key = db.get_setting("ai.apiKey").ok().flatten().unwrap_or_default();
        let output_cap = db.get_setting("ai.requiresOutputCap").ok().flatten();
        let depth = db.get_setting("analysis.analysisDepth").ok().flatten().unwrap_or_else(|| "balanced".to_string());
        let mode = db.get_setting("analysis.checkpointMode").ok().flatten().unwrap_or_else(|| "free_text".to_string());
        let ignored = db.get_setting("project.ignoredPaths").ok().flatten().unwrap_or_default();

        (
            ai::AiConfig {
                endpoint_url: endpoint,
                model,
                api_key,
                requires_output_cap: output_cap,
            },
            depth,
            mode,
            ignored,
        )
    };

    if ai_config.endpoint_url.is_empty() || ai_config.model.is_empty() {
        return Err("AI endpoint URL and model must be configured in Settings".to_string());
    }

    // 4. Get commit diff
    let diff = git::get_commit_diff(&project_path, &commit_hash)?;
    let commit_info = git::list_recent_commits(&project_path, 50)?
        .into_iter()
        .find(|c| c.hash == commit_hash)
        .ok_or("Commit not found in git log")?;

    let file_diffs = git::parse_diff_to_file_diffs(&diff);
    let changed_files: Vec<String> = file_diffs.iter().map(|f| f.file_name.clone()).collect();

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

    let (system_message, skills_used) = context::assemble_system_message(
        &base_prompt,
        &analysis_depth,
        &checkpoint_mode,
        &manual_skills,
        &auto_skills,
        100_000,
    );

    let system_tokens = context::estimate_tokens(&system_message, false);
    let (user_message, reduction_log) = context::assemble_user_message(
        &project_structure,
        &commit_info,
        &history,
        &diff,
        system_tokens,
    );

    // 7. Call AI
    let debrief_result = ai::run_debrief(&ai_config, &system_message, &user_message)
        .await
        .map_err(|e| format!("AI debrief failed: {}", e))?;

    let ai_response = debrief_result.response;

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
    Ok(debrief_to_dto(&debrief, &gaps))
}

#[tauri::command]
pub async fn get_diff_content(
    state: State<'_, AppState>,
    project_id: i64,
    commit_hash: String,
) -> Result<Vec<git::FileDiff>, String> {
    let db = state.db();
    let project = db
        .get_project(project_id)
        .map_err(|e| format!("Project not found: {}", e))?;

    let diff = git::get_commit_diff(&project.path, &commit_hash)?;
    Ok(git::parse_diff_to_file_diffs(&diff))
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
