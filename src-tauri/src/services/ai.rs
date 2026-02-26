use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};

#[derive(Debug, Clone)]
pub struct AiConfig {
    pub endpoint_url: String,
    pub model: String,
    pub api_key: String,
    pub requires_output_cap: Option<String>,
}

#[derive(Debug, thiserror::Error)]
pub enum AiError {
    #[error("Request timeout")]
    Timeout,
    #[error("Rate limited, retry after {0}s")]
    RateLimit(u64),
    #[error("Server error: {0}")]
    ServerError(String),
    #[error("Network error: {0}")]
    NetworkError(String),
    #[error("Failed to parse response: {0}")]
    ParseError(String),
    #[error("Invalid response: {0}")]
    InvalidResponse(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebriefResponse {
    #[serde(default, alias = "schemaVersion")]
    pub schema_version: u32,
    #[serde(alias = "architecturalSummary")]
    pub architectural_summary: String,
    #[serde(default, alias = "patternsIdentified")]
    pub patterns_identified: Vec<String>,
    #[serde(default, alias = "decisionsMade")]
    pub decisions_made: Vec<Decision>,
    #[serde(default)]
    pub gaps: Vec<GapData>,
    #[serde(default, alias = "checkpointQuestions")]
    pub checkpoint_questions: Vec<CheckpointQuestion>,
    #[serde(default, alias = "knowledge_base_notes", alias = "knowledgeBaseNotes", alias = "suggestedNotes")]
    pub suggested_notes: Vec<SuggestedNote>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Decision {
    pub decision: String,
    pub alternatives: String,
    pub tradeoffs: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GapData {
    pub severity: String,
    pub category: String,
    pub description: String,
    #[serde(default)]
    pub explanation: String,
    #[serde(default)]
    pub suggestion: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckpointQuestion {
    pub question: String,
    pub concept: String,
    #[serde(alias = "goodAnswerIncludes")]
    pub good_answer_includes: String,
    #[serde(default)]
    pub options: Option<Vec<String>>,
    #[serde(default, alias = "correctOptionIndex")]
    pub correct_option_index: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SuggestedNote {
    pub title: String,
    pub category: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub links_to: Vec<String>,
    #[serde(default)]
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvaluationResponse {
    pub score: u8,
    pub feedback: String,
    #[serde(default)]
    pub key_points_covered: Vec<String>,
    #[serde(default)]
    pub key_points_missed: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KbNoteInput {
    pub title: String,
    pub category: String,
    pub tags: Vec<String>,
    pub links_to: Vec<String>,
    pub existing_content: Option<String>,
    pub full_debrief_json: String,
    pub diff_snippet: String,
    pub commit_message: String,
    pub project_name: String,
    pub existing_titles: Vec<String>,
    pub existing_notes_catalog: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KbNoteResponse {
    pub title: String,
    pub content: String,
}

/// Result from a completion that may have discovered an output cap requirement.
struct CompletionResult {
    content: String,
    /// If set, the caller should persist this as ai.requiresOutputCap
    discovered_output_cap: Option<String>,
}

pub struct DebriefResult {
    pub response: DebriefResponse,
    /// If set, the caller should persist this value as the "ai.requiresOutputCap" setting
    pub discovered_output_cap: Option<String>,
}

pub const RAW_DEBRIEF_RESPONSE_START: &str = "__RAW_DEBRIEF_RESPONSE_START__";
pub const RAW_DEBRIEF_RESPONSE_END: &str = "__RAW_DEBRIEF_RESPONSE_END__";
pub const RAW_DEBRIEF_REPAIR_RESPONSE_START: &str = "__RAW_DEBRIEF_REPAIR_RESPONSE_START__";
pub const RAW_DEBRIEF_REPAIR_RESPONSE_END: &str = "__RAW_DEBRIEF_REPAIR_RESPONSE_END__";

pub async fn run_debrief(
    config: &AiConfig,
    system_message: &str,
    user_message: &str,
) -> Result<DebriefResult, AiError> {
    let result = call_chat_completion(
        config,
        system_message,
        user_message,
        0.3,
        Duration::from_secs(120),
    )
    .await?;

    let mut discovered_output_cap = result.discovered_output_cap.clone();

    match parse_json_response::<DebriefResponse>(&result.content) {
        Ok(response) => Ok(DebriefResult {
            response,
            discovered_output_cap,
        }),
        Err(initial_error) => {
            eprintln!(
                "[ai] debrief JSON parse failed, attempting repair pass error={}",
                initial_error
            );

            let repair_result = repair_debrief_json(config, &result.content).await?;
            if discovered_output_cap.is_none() {
                discovered_output_cap = repair_result.discovered_output_cap.clone();
            }

            let repaired = match parse_json_response::<DebriefResponse>(&repair_result.content) {
                Ok(parsed) => parsed,
                Err(repair_error) => {
                    return Err(AiError::ParseError(format!(
                        "Failed to parse response after repair. initial_error={} repair_error={}\n{}\n{}\n{}\n{}\n{}\n{}",
                        initial_error,
                        repair_error,
                        RAW_DEBRIEF_RESPONSE_START,
                        result.content,
                        RAW_DEBRIEF_RESPONSE_END,
                        RAW_DEBRIEF_REPAIR_RESPONSE_START,
                        repair_result.content,
                        RAW_DEBRIEF_REPAIR_RESPONSE_END
                    )))
                }
            };

            eprintln!("[ai] debrief JSON repair pass succeeded");
            Ok(DebriefResult {
                response: repaired,
                discovered_output_cap,
            })
        }
    }
}

pub async fn evaluate_checkpoint(
    config: &AiConfig,
    question: &str,
    good_answer_includes: &str,
    user_answer: &str,
) -> Result<EvaluationResponse, AiError> {
    let system = "You are evaluating a developer's answer to a checkpoint question about code they committed. Respond ONLY with valid JSON in this format: {\"score\": <0-10>, \"feedback\": \"<concise feedback>\", \"key_points_covered\": [\"<points>\"], \"key_points_missed\": [\"<points>\"]}";

    let user = format!(
        "Question: {}\n\nExpected key points: {}\n\nDeveloper's answer: {}",
        question, good_answer_includes, user_answer
    );

    let result = call_chat_completion(config, system, &user, 0.3, Duration::from_secs(60)).await?;

    parse_json_response::<EvaluationResponse>(&result.content)
}

pub async fn generate_kb_note(
    config: &AiConfig,
    note_input: &KbNoteInput,
) -> Result<KbNoteResponse, AiError> {
    let system = r#"You are generating an Obsidian-compatible knowledge base note. The note should:
- Use [[double bracket links]] (Wikilinks) to reference related concepts
- Link aggressively: if a concept is mentioned, link it
- Base the note on the full debrief context, but keep the explanation generally useful
- Mention concrete diff details only when they are clearly supported by the diff/debrief
- Check existing notes and merge/update concept coverage instead of duplicating content
- Keep notes concise and scannable
- Do NOT include YAML frontmatter (the app adds it)

Respond ONLY with valid JSON: {"title": "<note title>", "content": "<markdown body without frontmatter>"}"#;

    let existing_titles_str = if note_input.existing_titles.is_empty() {
        String::new()
    } else {
        format!("\n\nExisting KB note titles for linking:\n{}", note_input.existing_titles.join(", "))
    };

    let existing_content_str = note_input
        .existing_content
        .as_ref()
        .map(|c| format!("\n\nExisting note content to merge with:\n{}", c))
        .unwrap_or_default();

    let existing_catalog_str = if note_input.existing_notes_catalog.is_empty() {
        String::new()
    } else {
        format!(
            "\n\nExisting KB notes catalog (title :: category):\n{}",
            note_input.existing_notes_catalog.join("\n")
        )
    };

    let user = format!(
        "Generate a knowledge base note.\n\nTitle: {}\nCategory: {}\nTags: {}\nLinks to: {}\nProject: {}\nCommit: {}\n\nFull debrief JSON:\n```json\n{}\n```\n\nRelevant diff snippet:\n```\n{}\n```{}{}{}",
        note_input.title,
        note_input.category,
        note_input.tags.join(", "),
        note_input.links_to.join(", "),
        note_input.project_name,
        note_input.commit_message,
        note_input.full_debrief_json,
        note_input.diff_snippet,
        existing_titles_str,
        existing_catalog_str,
        existing_content_str,
    );

    let result = call_chat_completion(config, system, &user, 0.3, Duration::from_secs(90)).await?;

    parse_json_response::<KbNoteResponse>(&result.content)
}

pub async fn test_connection(config: &AiConfig) -> Result<bool, AiError> {
    let system = "Respond with exactly: {\"status\": \"ok\"}";
    let user = "Test connection. Respond with JSON only.";

    call_chat_completion(config, system, user, 0.0, Duration::from_secs(15)).await?;
    Ok(true)
}

async fn call_chat_completion(
    config: &AiConfig,
    system: &str,
    user: &str,
    temperature: f32,
    timeout: Duration,
) -> Result<CompletionResult, AiError> {
    let call_started_at = Instant::now();
    let client = reqwest::Client::new();

    let url = format!(
        "{}/chat/completions",
        config.endpoint_url.trim_end_matches('/')
    );

    let mut body = serde_json::json!({
        "model": config.model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user}
        ],
        "temperature": temperature,
        "response_format": {"type": "json_object"}
    });

    // Apply output cap if known to be required
    if let Some(ref cap) = config.requires_output_cap {
        let parts: Vec<&str> = cap.splitn(2, ':').collect();
        if parts.len() == 2 {
            if let Ok(val) = parts[1].parse::<u32>() {
                body.as_object_mut()
                    .unwrap()
                    .insert(parts[0].to_string(), serde_json::json!(val));
            }
        }
    }

    let mut request = client.post(&url).timeout(timeout).json(&body);

    if !config.api_key.is_empty() {
        request = request.header("Authorization", format!("Bearer {}", config.api_key));
    }

    eprintln!(
        "[ai] chat completion request started model={} endpoint={} system_chars={} user_chars={} timeout_ms={}",
        config.model,
        config.endpoint_url,
        system.len(),
        user.len(),
        timeout.as_millis()
    );

    let response = request.send().await.map_err(|e| {
        if e.is_timeout() {
            AiError::Timeout
        } else {
            AiError::NetworkError(e.to_string())
        }
    })?;

    let status = response.status();
    eprintln!(
        "[ai] chat completion response status={} elapsed_ms={}",
        status,
        call_started_at.elapsed().as_millis()
    );

    if status == 429 {
        let retry_after = response
            .headers()
            .get("retry-after")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.parse::<u64>().ok())
            .unwrap_or(30);
        return Err(AiError::RateLimit(retry_after));
    }

    if !status.is_success() {
        let error_body = response.text().await.unwrap_or_default();
        let error_preview = &error_body[..error_body.len().min(240)];
        eprintln!(
            "[ai] chat completion non-success status={} error_preview={}",
            status, error_preview
        );

        // If the error explicitly mentions a token cap requirement, retry with one.
        // Only trigger when the error body names the specific field — not on generic 400s.
        if config.requires_output_cap.is_none()
            && (error_body.contains("max_completion_tokens")
                || error_body.contains("max_tokens"))
        {
            // Determine which cap key to use based on error message
            let cap_key = if error_body.contains("max_completion_tokens") {
                "max_completion_tokens"
            } else {
                "max_tokens"
            };

            let retry_body = serde_json::json!({
                "model": config.model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user}
                ],
                "temperature": temperature,
                "response_format": {"type": "json_object"},
                cap_key: 16000
            });

            let mut retry_request = client.post(&url).timeout(timeout).json(&retry_body);
            if !config.api_key.is_empty() {
                retry_request = retry_request.header("Authorization", format!("Bearer {}", config.api_key));
            }
            eprintln!(
                "[ai] retrying chat completion with output cap key={} value=16000",
                cap_key
            );

            let retry_response = retry_request.send().await.map_err(|e| {
                if e.is_timeout() { AiError::Timeout } else { AiError::NetworkError(e.to_string()) }
            })?;
            eprintln!(
                "[ai] retry response status={} total_elapsed_ms={}",
                retry_response.status(),
                call_started_at.elapsed().as_millis()
            );

            if !retry_response.status().is_success() {
                let retry_error = retry_response.text().await.unwrap_or_default();
                return Err(AiError::ServerError(format!("HTTP retry failed: {}", retry_error)));
            }

            let retry_json: serde_json::Value = retry_response
                .json()
                .await
                .map_err(|e| AiError::ParseError(e.to_string()))?;

            let retry_content = retry_json["choices"][0]["message"]["content"]
                .as_str()
                .ok_or_else(|| AiError::InvalidResponse("Missing content in retry".to_string()))?;
            eprintln!(
                "[ai] retry completion parsed content_chars={} total_elapsed_ms={}",
                retry_content.len(),
                call_started_at.elapsed().as_millis()
            );

            return Ok(CompletionResult {
                content: retry_content.to_string(),
                discovered_output_cap: Some(format!("{}:16000", cap_key)),
            });
        }

        return Err(AiError::ServerError(format!(
            "HTTP {} - {}",
            status, error_body
        )));
    }

    let resp_json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| AiError::ParseError(e.to_string()))?;

    let content = resp_json["choices"][0]["message"]["content"]
        .as_str()
        .ok_or_else(|| AiError::InvalidResponse("Missing choices[0].message.content".to_string()))?;
    eprintln!(
        "[ai] chat completion parsed content_chars={} elapsed_ms={}",
        content.len(),
        call_started_at.elapsed().as_millis()
    );

    Ok(CompletionResult {
        content: content.to_string(),
        discovered_output_cap: None,
    })
}

async fn repair_debrief_json(config: &AiConfig, raw_response: &str) -> Result<CompletionResult, AiError> {
    let system = r#"You repair malformed AI output into valid JSON.
Return ONLY a valid JSON object (no markdown, no code fences, no commentary).
Use this schema and keys exactly:
{
  "schema_version": number,
  "architectural_summary": string,
  "patterns_identified": string[],
  "decisions_made": [{"decision": string, "alternatives": string, "tradeoffs": string}],
  "gaps": [{"severity": string, "category": string, "description": string, "explanation": string, "suggestion": string}],
  "checkpoint_questions": [{"question": string, "concept": string, "good_answer_includes": string, "options": string[]|null, "correct_option_index": number|null}],
  "suggested_notes": [{"title": string, "category": string, "tags": string[], "links_to": string[], "content": string}]
}
If some fields are missing, infer concise placeholders and keep arrays empty when uncertain."#;

    let user = format!(
        "Repair this into valid JSON following the schema exactly:\n\n{}",
        raw_response
    );

    call_chat_completion(config, system, &user, 0.0, Duration::from_secs(90)).await
}

fn parse_json_response<T: serde::de::DeserializeOwned>(raw: &str) -> Result<T, AiError> {
    // Try direct parse first
    let direct_err = match serde_json::from_str::<T>(raw) {
        Ok(parsed) => return Ok(parsed),
        Err(err) => err.to_string(),
    };

    // Try to extract JSON from markdown code fences
    let cleaned = raw
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    let cleaned_err = match serde_json::from_str::<T>(cleaned) {
        Ok(parsed) => return Ok(parsed),
        Err(err) => err.to_string(),
    };

    // Try to find outermost { ... } block
    let mut block_err = String::from("No outer JSON object found");
    if let Some(start) = raw.find('{') {
        if let Some(end) = raw.rfind('}') {
            let json_str = &raw[start..=end];
            match serde_json::from_str::<T>(json_str) {
                Ok(parsed) => return Ok(parsed),
                Err(err) => block_err = err.to_string(),
            }
        }
    }

    Err(AiError::ParseError(format!(
        "Failed to parse JSON from response. direct_error={} cleaned_error={} block_error={} preview={}",
        direct_err,
        cleaned_err,
        block_err,
        &raw[..raw.len().min(200)]
    )))
}
