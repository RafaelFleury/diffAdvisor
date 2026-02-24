use rusqlite::params;

use super::error::{DbError, DbResult};
use super::models::Debrief;
use super::Database;

impl Database {
    pub fn create_debrief(
        &self,
        project_id: i64,
        commit_hash: &str,
        commit_message: &str,
        diff_content: &str,
        ai_response_json: Option<&str>,
        skills_used: &[String],
    ) -> DbResult<Debrief> {
        let conn = self.conn();
        let skills_json = serde_json::to_string(skills_used)?;

        conn.execute(
            "INSERT INTO debriefs (project_id, commit_hash, commit_message, diff_content, ai_response_json, skills_used) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![project_id, commit_hash, commit_message, diff_content, ai_response_json, skills_json],
        )?;

        let id = conn.last_insert_rowid();
        drop(conn);
        self.get_debrief(id)
    }

    pub fn get_debrief(&self, id: i64) -> DbResult<Debrief> {
        let conn = self.conn();
        conn.query_row(
            "SELECT id, project_id, commit_hash, commit_message, diff_content, ai_response_json, skills_used, status, created_at FROM debriefs WHERE id = ?1",
            params![id],
            |row| Ok(Self::row_to_debrief(row)),
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => DbError::NotFound,
            _ => DbError::SqliteError(e),
        })
    }

    pub fn get_debrief_by_commit(&self, project_id: i64, commit_hash: &str) -> DbResult<Option<Debrief>> {
        let conn = self.conn();
        let result = conn.query_row(
            "SELECT id, project_id, commit_hash, commit_message, diff_content, ai_response_json, skills_used, status, created_at FROM debriefs WHERE project_id = ?1 AND commit_hash = ?2",
            params![project_id, commit_hash],
            |row| Ok(Self::row_to_debrief(row)),
        );
        match result {
            Ok(debrief) => Ok(Some(debrief)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(DbError::SqliteError(e)),
        }
    }

    pub fn list_debriefs_by_project(&self, project_id: i64) -> DbResult<Vec<Debrief>> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, commit_hash, commit_message, diff_content, ai_response_json, skills_used, status, created_at FROM debriefs WHERE project_id = ?1 ORDER BY created_at DESC",
        )?;
        let rows = stmt.query_map(params![project_id], |row| Ok(Self::row_to_debrief(row)))?;
        let mut debriefs = Vec::new();
        for row in rows {
            debriefs.push(row?);
        }
        Ok(debriefs)
    }

    pub fn list_debriefs_by_status(
        &self,
        project_id: i64,
        status: &str,
    ) -> DbResult<Vec<Debrief>> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, commit_hash, commit_message, diff_content, ai_response_json, skills_used, status, created_at FROM debriefs WHERE project_id = ?1 AND status = ?2 ORDER BY created_at DESC",
        )?;
        let rows = stmt.query_map(params![project_id, status], |row| {
            Ok(Self::row_to_debrief(row))
        })?;
        let mut debriefs = Vec::new();
        for row in rows {
            debriefs.push(row?);
        }
        Ok(debriefs)
    }

    pub fn mark_debrief_reviewed(&self, id: i64) -> DbResult<()> {
        let conn = self.conn();
        let rows = conn.execute(
            "UPDATE debriefs SET status = 'reviewed' WHERE id = ?1",
            params![id],
        )?;
        if rows == 0 {
            return Err(DbError::NotFound);
        }
        Ok(())
    }

    fn row_to_debrief(row: &rusqlite::Row) -> Debrief {
        let skills_str: String = row.get(6).unwrap_or_default();
        Debrief {
            id: row.get(0).unwrap(),
            project_id: row.get(1).unwrap(),
            commit_hash: row.get(2).unwrap(),
            commit_message: row.get(3).unwrap_or_default(),
            diff_content: row.get(4).unwrap_or_default(),
            ai_response_json: row.get(5).unwrap_or(None),
            skills_used: serde_json::from_str(&skills_str).unwrap_or_default(),
            status: row.get(7).unwrap_or_default(),
            created_at: row.get(8).unwrap(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup() -> (Database, i64) {
        let db = Database::open_in_memory().unwrap();
        let project = db
            .create_project("Test", "/tmp/test", "ts", &[], &[])
            .unwrap();
        (db, project.id)
    }

    #[test]
    fn test_create_debrief() {
        let (db, pid) = setup();
        let debrief = db
            .create_debrief(pid, "abc123", "initial commit", "diff content", Some("{\"test\": true}"), &["security".into()])
            .unwrap();
        assert_eq!(debrief.commit_hash, "abc123");
        assert_eq!(debrief.commit_message, "initial commit");
        assert_eq!(debrief.status, "pending");
        assert_eq!(debrief.skills_used, vec!["security"]);
    }

    #[test]
    fn test_get_debrief_by_commit() {
        let (db, pid) = setup();
        db.create_debrief(pid, "abc123", "test", "", None, &[]).unwrap();
        let found = db.get_debrief_by_commit(pid, "abc123").unwrap();
        assert!(found.is_some());
        assert_eq!(found.unwrap().commit_hash, "abc123");
    }

    #[test]
    fn test_get_debrief_by_commit_not_found() {
        let (db, pid) = setup();
        let result = db.get_debrief_by_commit(pid, "nonexistent").unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_get_debrief_by_commit_scoped_to_project() {
        let (db, pid1) = setup();
        let p2 = db.create_project("Other", "/tmp/other", "ts", &[], &[]).unwrap();
        db.create_debrief(pid1, "abc123", "commit on p1", "", None, &[]).unwrap();
        db.create_debrief(p2.id, "abc123", "commit on p2", "", None, &[]).unwrap();

        let found1 = db.get_debrief_by_commit(pid1, "abc123").unwrap().unwrap();
        assert_eq!(found1.commit_message, "commit on p1");

        let found2 = db.get_debrief_by_commit(p2.id, "abc123").unwrap().unwrap();
        assert_eq!(found2.commit_message, "commit on p2");

        let not_found = db.get_debrief_by_commit(pid1, "nonexistent").unwrap();
        assert!(not_found.is_none());
    }

    #[test]
    fn test_list_by_project() {
        let (db, pid) = setup();
        db.create_debrief(pid, "abc123", "c1", "", None, &[]).unwrap();
        db.create_debrief(pid, "def456", "c2", "", None, &[]).unwrap();
        let debriefs = db.list_debriefs_by_project(pid).unwrap();
        assert_eq!(debriefs.len(), 2);
    }

    #[test]
    fn test_list_by_status() {
        let (db, pid) = setup();
        let d1 = db.create_debrief(pid, "abc123", "c1", "", None, &[]).unwrap();
        db.create_debrief(pid, "def456", "c2", "", None, &[]).unwrap();
        db.mark_debrief_reviewed(d1.id).unwrap();

        let pending = db.list_debriefs_by_status(pid, "pending").unwrap();
        assert_eq!(pending.len(), 1);
        let reviewed = db.list_debriefs_by_status(pid, "reviewed").unwrap();
        assert_eq!(reviewed.len(), 1);
    }

    #[test]
    fn test_mark_reviewed() {
        let (db, pid) = setup();
        let debrief = db.create_debrief(pid, "abc123", "test", "", None, &[]).unwrap();
        assert_eq!(debrief.status, "pending");
        db.mark_debrief_reviewed(debrief.id).unwrap();
        let updated = db.get_debrief(debrief.id).unwrap();
        assert_eq!(updated.status, "reviewed");
    }

    #[test]
    fn test_mark_reviewed_not_found() {
        let (db, _) = setup();
        let result = db.mark_debrief_reviewed(9999);
        assert!(matches!(result, Err(DbError::NotFound)));
    }

    #[test]
    fn test_get_debrief_not_found() {
        let (db, _) = setup();
        let result = db.get_debrief(9999);
        assert!(matches!(result, Err(DbError::NotFound)));
    }

    #[test]
    fn test_cascade_to_gaps_and_checkpoints() {
        let (db, pid) = setup();
        let debrief = db.create_debrief(pid, "abc123", "test", "", None, &[]).unwrap();

        db.create_gaps(
            debrief.id,
            &[("critical", "security", "No auth", "", "")],
        )
        .unwrap();
        db.create_checkpoint_response(debrief.id, "q1", "What is?", "My answer", "free_text")
            .unwrap();

        db.delete_project(pid).unwrap();

        let gaps = db.get_gaps_by_debrief(debrief.id).unwrap();
        assert!(gaps.is_empty());
        let checkpoints = db.get_checkpoint_responses(debrief.id).unwrap();
        assert!(checkpoints.is_empty());
    }
}
