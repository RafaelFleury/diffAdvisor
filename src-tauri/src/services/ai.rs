use serde::{Deserialize, Serialize};
use std::time::Duration;

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
#[serde(rename_all = "camelCase")]
pub struct DebriefResponse {
    #[serde(default)]
    pub schema_version: u32,
    pub architectural_summary: String,
    #[serde(default)]
    pub patterns_identified: Vec<String>,
    #[serde(default)]
    pub decisions_made: Vec<Decision>,
    #[serde(default)]
    pub gaps: Vec<GapData>,
    #[serde(default)]
    pub checkpoint_questions: Vec<CheckpointQuestion>,
    #[serde(default, alias = "knowledge_base_notes")]
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
#[serde(rename_all = "camelCase")]
pub struct CheckpointQuestion {
    pub question: String,
    pub concept: String,
    pub good_answer_includes: String,
    #[serde(default)]
    pub options: Option<Vec<String>>,
    #[serde(default)]
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
    pub diff_snippet: String,
    pub commit_message: String,
    pub project_name: String,
    pub existing_titles: Vec<String>,
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

    let response = parse_json_response::<DebriefResponse>(&result.content)?;
    Ok(DebriefResult {
        response,
        discovered_output_cap: result.discovered_output_cap,
    })
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
- Write for the developer's project context, not generic tutorials
- Include concrete code examples from the analyzed diff when useful
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

    let user = format!(
        "Generate a knowledge base note.\n\nTitle: {}\nCategory: {}\nTags: {}\nLinks to: {}\nProject: {}\nCommit: {}\n\nRelevant diff snippet:\n```\n{}\n```{}{}",
        note_input.title,
        note_input.category,
        note_input.tags.join(", "),
        note_input.links_to.join(", "),
        note_input.project_name,
        note_input.commit_message,
        note_input.diff_snippet,
        existing_titles_str,
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

    let response = request.send().await.map_err(|e| {
        if e.is_timeout() {
            AiError::Timeout
        } else {
            AiError::NetworkError(e.to_string())
        }
    })?;

    let status = response.status();

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

            let retry_response = retry_request.send().await.map_err(|e| {
                if e.is_timeout() { AiError::Timeout } else { AiError::NetworkError(e.to_string()) }
            })?;

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

    Ok(CompletionResult {
        content: content.to_string(),
        discovered_output_cap: None,
    })
}

fn parse_json_response<T: serde::de::DeserializeOwned>(raw: &str) -> Result<T, AiError> {
    // Try direct parse first
    if let Ok(parsed) = serde_json::from_str::<T>(raw) {
        return Ok(parsed);
    }

    // Try to extract JSON from markdown code fences
    let cleaned = raw
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    if let Ok(parsed) = serde_json::from_str::<T>(cleaned) {
        return Ok(parsed);
    }

    // Try to find outermost { ... } block
    if let Some(start) = raw.find('{') {
        if let Some(end) = raw.rfind('}') {
            let json_str = &raw[start..=end];
            if let Ok(parsed) = serde_json::from_str::<T>(json_str) {
                return Ok(parsed);
            }
        }
    }

    Err(AiError::ParseError(format!(
        "Failed to parse JSON from response: {}",
        &raw[..raw.len().min(200)]
    )))
}
