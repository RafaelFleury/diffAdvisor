use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: i64,
    pub name: String,
    pub path: String,
    pub language: String,
    pub frameworks: Vec<String>,
    pub active_skills: Vec<String>,
    pub created_at: String,
    pub last_analyzed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Debrief {
    pub id: i64,
    pub project_id: i64,
    pub commit_hash: String,
    pub commit_message: String,
    pub diff_content: String,
    pub ai_response_json: Option<String>,
    pub skills_used: Vec<String>,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Gap {
    pub id: i64,
    pub debrief_id: i64,
    pub severity: String,
    pub category: String,
    pub description: String,
    pub resolved: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckpointResponse {
    pub id: i64,
    pub debrief_id: i64,
    pub question_id: String,
    pub question_text: String,
    pub response_text: String,
    pub ai_evaluation_json: Option<String>,
    pub mode: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeNote {
    pub id: i64,
    pub project_id: Option<i64>,
    pub title: String,
    pub category_path: String,
    pub file_path: String,
    pub auto_generated: bool,
    pub tags: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Setting {
    pub key: String,
    pub value: String,
}
