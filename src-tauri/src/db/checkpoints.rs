use rusqlite::params;

use super::error::{DbError, DbResult};
use super::models::CheckpointResponse;
use super::Database;

impl Database {
    pub fn create_checkpoint_response(
        &self,
        debrief_id: i64,
        question_id: &str,
        question_text: &str,
        response_text: &str,
        mode: &str,
    ) -> DbResult<CheckpointResponse> {
        let conn = self.conn();
        conn.execute(
            "INSERT INTO checkpoint_responses (debrief_id, question_id, question_text, response_text, mode) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![debrief_id, question_id, question_text, response_text, mode],
        )?;
        let id = conn.last_insert_rowid();
        drop(conn);
        self.get_checkpoint_response(id)
    }

    fn get_checkpoint_response(&self, id: i64) -> DbResult<CheckpointResponse> {
        let conn = self.conn();
        conn.query_row(
            "SELECT id, debrief_id, question_id, question_text, response_text, ai_evaluation_json, mode, created_at FROM checkpoint_responses WHERE id = ?1",
            params![id],
            |row| Ok(Self::row_to_checkpoint(row)),
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => DbError::NotFound,
            _ => DbError::SqliteError(e),
        })
    }

    pub fn get_checkpoint_responses(&self, debrief_id: i64) -> DbResult<Vec<CheckpointResponse>> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            "SELECT id, debrief_id, question_id, question_text, response_text, ai_evaluation_json, mode, created_at FROM checkpoint_responses WHERE debrief_id = ?1 ORDER BY created_at",
        )?;
        let rows = stmt.query_map(params![debrief_id], |row| {
            Ok(Self::row_to_checkpoint(row))
        })?;
        let mut responses = Vec::new();
        for row in rows {
            responses.push(row?);
        }
        Ok(responses)
    }

    pub fn update_checkpoint_evaluation(
        &self,
        id: i64,
        ai_evaluation_json: &str,
    ) -> DbResult<()> {
        let conn = self.conn();
        let rows = conn.execute(
            "UPDATE checkpoint_responses SET ai_evaluation_json = ?1 WHERE id = ?2",
            params![ai_evaluation_json, id],
        )?;
        if rows == 0 {
            return Err(DbError::NotFound);
        }
        Ok(())
    }

    fn row_to_checkpoint(row: &rusqlite::Row) -> CheckpointResponse {
        CheckpointResponse {
            id: row.get(0).unwrap(),
            debrief_id: row.get(1).unwrap(),
            question_id: row.get(2).unwrap_or_default(),
            question_text: row.get(3).unwrap(),
            response_text: row.get(4).unwrap_or_default(),
            ai_evaluation_json: row.get(5).unwrap_or(None),
            mode: row.get(6).unwrap_or_default(),
            created_at: row.get(7).unwrap(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup() -> (Database, i64) {
        let db = Database::open_in_memory().unwrap();
        let project = db.create_project("Test", "/tmp/test", "ts", &[], &[]).unwrap();
        let debrief = db
            .create_debrief(project.id, "abc123", "test", "", None, &[])
            .unwrap();
        (db, debrief.id)
    }

    #[test]
    fn test_create_checkpoint_response() {
        let (db, debrief_id) = setup();
        let response = db
            .create_checkpoint_response(
                debrief_id,
                "q1",
                "What happens if the server crashes?",
                "Data could be lost",
                "free_text",
            )
            .unwrap();
        assert_eq!(response.question_id, "q1");
        assert_eq!(response.question_text, "What happens if the server crashes?");
        assert_eq!(response.response_text, "Data could be lost");
        assert_eq!(response.mode, "free_text");
        assert!(response.ai_evaluation_json.is_none());
    }

    #[test]
    fn test_get_by_debrief() {
        let (db, debrief_id) = setup();
        db.create_checkpoint_response(debrief_id, "q1", "Q1?", "A1", "free_text")
            .unwrap();
        db.create_checkpoint_response(debrief_id, "q2", "Q2?", "A2", "multiple_choice")
            .unwrap();

        let responses = db.get_checkpoint_responses(debrief_id).unwrap();
        assert_eq!(responses.len(), 2);
    }

    #[test]
    fn test_update_evaluation_not_found() {
        let (db, _) = setup();
        let result = db.update_checkpoint_evaluation(9999, r#"{"score": 5}"#);
        assert!(matches!(result, Err(DbError::NotFound)));
    }

    #[test]
    fn test_update_evaluation() {
        let (db, debrief_id) = setup();
        let response = db
            .create_checkpoint_response(debrief_id, "q1", "Q?", "A", "free_text")
            .unwrap();
        assert!(response.ai_evaluation_json.is_none());

        let eval = r#"{"score": 8, "feedback": "Good answer"}"#;
        db.update_checkpoint_evaluation(response.id, eval).unwrap();

        let responses = db.get_checkpoint_responses(debrief_id).unwrap();
        assert_eq!(responses[0].ai_evaluation_json.as_deref(), Some(eval));
    }
}
