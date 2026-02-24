use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::models::CheckpointResponse;
use crate::services::ai;
use crate::state::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvaluationDto {
    pub score: u8,
    pub feedback: String,
    pub key_points_covered: Vec<String>,
    pub key_points_missed: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckpointResponseDto {
    pub id: String,
    pub debrief_id: String,
    pub question_id: String,
    pub question_text: String,
    pub response_text: String,
    pub evaluation: Option<EvaluationDto>,
    pub mode: String,
    pub created_at: String,
}

fn checkpoint_to_dto(cr: &CheckpointResponse) -> CheckpointResponseDto {
    let evaluation = cr.ai_evaluation_json.as_ref().and_then(|json| {
        serde_json::from_str::<EvaluationDto>(json).ok()
    });

    CheckpointResponseDto {
        id: cr.id.to_string(),
        debrief_id: cr.debrief_id.to_string(),
        question_id: cr.question_id.clone(),
        question_text: cr.question_text.clone(),
        response_text: cr.response_text.clone(),
        evaluation,
        mode: cr.mode.clone(),
        created_at: cr.created_at.clone(),
    }
}

/// Parse a question_id like "q0", "q1", "q-1", or even bare "0", "1" into a
/// zero-based array index. Returns None if the format is unrecognized.
fn parse_question_index(question_id: &str) -> Option<usize> {
    // Strip leading "q" or "q-" prefix
    let numeric_part = question_id
        .strip_prefix("q-")
        .or_else(|| question_id.strip_prefix('q'))
        .unwrap_or(question_id);

    numeric_part.parse::<usize>().ok()
}

/// Look up a checkpoint question's text and good_answer_includes from the debrief's
/// stored AI response JSON, using the question_id (e.g. "q0", "q1").
fn lookup_question_data(
    ai_response_json: Option<&str>,
    question_id: &str,
) -> (String, String) {
    let index = match parse_question_index(question_id) {
        Some(i) => i,
        None => return (String::new(), String::new()),
    };

    if let Some(json) = ai_response_json {
        if let Ok(response) = serde_json::from_str::<ai::DebriefResponse>(json) {
            if let Some(q) = response.checkpoint_questions.get(index) {
                return (q.question.clone(), q.good_answer_includes.clone());
            }
        }
    }

    (String::new(), String::new())
}

#[tauri::command]
pub async fn submit_checkpoint(
    state: State<'_, AppState>,
    debrief_id: i64,
    question_id: String,
    question_text: String,
    good_answer_includes: String,
    answer: String,
    mode: String,
) -> Result<CheckpointResponseDto, String> {
    // If questionText and goodAnswerIncludes are empty (frontend didn't send them),
    // look them up from the debrief's AI response
    let (resolved_question_text, resolved_good_answer) = if question_text.is_empty() {
        let db = state.db();
        let debrief = db
            .get_debrief(debrief_id)
            .map_err(|e| format!("Debrief not found: {}", e))?;
        lookup_question_data(debrief.ai_response_json.as_deref(), &question_id)
    } else {
        (question_text, good_answer_includes)
    };

    let (cr, ai_config) = {
        let db = state.db();
        let cr = db
            .create_checkpoint_response(
                debrief_id,
                &question_id,
                &resolved_question_text,
                &answer,
                &mode,
            )
            .map_err(|e| format!("Failed to create checkpoint response: {}", e))?;

        let endpoint = db.get_setting("ai.endpointUrl").ok().flatten().unwrap_or_default();
        let model = db.get_setting("ai.model").ok().flatten().unwrap_or_default();
        let api_key = db.get_setting("ai.apiKey").ok().flatten().unwrap_or_default();
        let output_cap = db.get_setting("ai.requiresOutputCap").ok().flatten();
        let ai_config = ai::AiConfig {
            endpoint_url: endpoint,
            model,
            api_key,
            requires_output_cap: output_cap,
        };

        (cr, ai_config)
    }; // db guard dropped here

    if mode == "free_text" && !resolved_good_answer.is_empty() {
        match ai::evaluate_checkpoint(
            &ai_config,
            &resolved_question_text,
            &resolved_good_answer,
            &answer,
        )
        .await
        {
            Ok(eval) => {
                let eval_json = serde_json::to_string(&eval)
                    .map_err(|e| format!("Failed to serialize evaluation: {}", e))?;

                {
                    let db = state.db();
                    let _ = db.update_checkpoint_evaluation(cr.id, &eval_json);
                }

                let mut dto = checkpoint_to_dto(&cr);
                dto.evaluation = Some(EvaluationDto {
                    score: eval.score,
                    feedback: eval.feedback,
                    key_points_covered: eval.key_points_covered,
                    key_points_missed: eval.key_points_missed,
                });
                return Ok(dto);
            }
            Err(e) => {
                eprintln!("Checkpoint evaluation failed: {}", e);
            }
        }
    }

    Ok(checkpoint_to_dto(&cr))
}

#[tauri::command]
pub async fn get_checkpoint_responses(
    state: State<'_, AppState>,
    debrief_id: i64,
) -> Result<Vec<CheckpointResponseDto>, String> {
    let db = state.db();
    let responses = db
        .get_checkpoint_responses(debrief_id)
        .map_err(|e| format!("Failed to get checkpoint responses: {}", e))?;

    Ok(responses.iter().map(checkpoint_to_dto).collect())
}
