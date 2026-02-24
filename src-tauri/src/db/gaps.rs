use rusqlite::params;

use super::error::{DbError, DbResult};
use super::models::Gap;
use super::Database;

impl Database {
    pub fn create_gaps(
        &self,
        debrief_id: i64,
        gaps_data: &[(&str, &str, &str, &str, &str)], // (severity, category, description, explanation, suggestion)
    ) -> DbResult<Vec<Gap>> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            "INSERT INTO gaps (debrief_id, severity, category, description, explanation, suggestion) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        )?;
        let mut ids = Vec::new();
        for (severity, category, description, explanation, suggestion) in gaps_data {
            stmt.execute(params![debrief_id, severity, category, description, explanation, suggestion])?;
            ids.push(conn.last_insert_rowid());
        }
        drop(stmt);
        drop(conn);

        let mut gaps = Vec::new();
        for id in ids {
            gaps.push(self.get_gap(id)?);
        }
        Ok(gaps)
    }

    fn get_gap(&self, id: i64) -> DbResult<Gap> {
        let conn = self.conn();
        conn.query_row(
            "SELECT id, debrief_id, severity, category, description, explanation, suggestion, resolved, created_at FROM gaps WHERE id = ?1",
            params![id],
            |row| Ok(Self::row_to_gap(row)),
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => DbError::NotFound,
            _ => DbError::SqliteError(e),
        })
    }

    pub fn get_gaps_by_debrief(&self, debrief_id: i64) -> DbResult<Vec<Gap>> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            "SELECT id, debrief_id, severity, category, description, explanation, suggestion, resolved, created_at FROM gaps WHERE debrief_id = ?1 ORDER BY created_at",
        )?;
        let rows = stmt.query_map(params![debrief_id], |row| Ok(Self::row_to_gap(row)))?;
        let mut gaps = Vec::new();
        for row in rows {
            gaps.push(row?);
        }
        Ok(gaps)
    }

    pub fn get_unresolved_gaps_by_project(&self, project_id: i64) -> DbResult<Vec<Gap>> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            "SELECT g.id, g.debrief_id, g.severity, g.category, g.description, g.explanation, g.suggestion, g.resolved, g.created_at
             FROM gaps g
             JOIN debriefs d ON g.debrief_id = d.id
             WHERE d.project_id = ?1 AND g.resolved = 0
             ORDER BY g.created_at DESC",
        )?;
        let rows = stmt.query_map(params![project_id], |row| Ok(Self::row_to_gap(row)))?;
        let mut gaps = Vec::new();
        for row in rows {
            gaps.push(row?);
        }
        Ok(gaps)
    }

    pub fn count_gaps_by_project(&self, project_id: i64) -> DbResult<i64> {
        let conn = self.conn();
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM gaps g JOIN debriefs d ON g.debrief_id = d.id WHERE d.project_id = ?1",
            params![project_id],
            |row| row.get(0),
        )?;
        Ok(count)
    }

    pub fn resolve_gap(&self, id: i64) -> DbResult<()> {
        let conn = self.conn();
        let rows = conn.execute(
            "UPDATE gaps SET resolved = 1 WHERE id = ?1",
            params![id],
        )?;
        if rows == 0 {
            return Err(DbError::NotFound);
        }
        Ok(())
    }

    fn row_to_gap(row: &rusqlite::Row) -> Gap {
        Gap {
            id: row.get(0).unwrap(),
            debrief_id: row.get(1).unwrap(),
            severity: row.get(2).unwrap_or_default(),
            category: row.get(3).unwrap_or_default(),
            description: row.get(4).unwrap_or_default(),
            explanation: row.get(5).unwrap_or_default(),
            suggestion: row.get(6).unwrap_or_default(),
            resolved: row.get::<_, i32>(7).unwrap_or(0) != 0,
            created_at: row.get(8).unwrap(),
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

    fn setup_with_project() -> (Database, i64, i64) {
        let db = Database::open_in_memory().unwrap();
        let project = db.create_project("Test", "/tmp/test", "ts", &[], &[]).unwrap();
        let debrief = db
            .create_debrief(project.id, "abc123", "test", "", None, &[])
            .unwrap();
        (db, project.id, debrief.id)
    }

    #[test]
    fn test_batch_create_gaps() {
        let (db, debrief_id) = setup();
        let gaps = db
            .create_gaps(
                debrief_id,
                &[
                    ("critical", "security", "No auth", "Auth is required for production", "Add JWT middleware"),
                    ("warning", "performance", "N+1 query", "Causes slow queries", "Use eager loading"),
                    ("info", "maintainability", "Consider refactoring", "Code is hard to read", "Extract helper function"),
                ],
            )
            .unwrap();
        assert_eq!(gaps.len(), 3);
        assert_eq!(gaps[0].severity, "critical");
        assert_eq!(gaps[0].explanation, "Auth is required for production");
        assert_eq!(gaps[0].suggestion, "Add JWT middleware");
        assert_eq!(gaps[1].severity, "warning");
        assert_eq!(gaps[2].severity, "info");
    }

    #[test]
    fn test_resolve_gap() {
        let (db, debrief_id) = setup();
        let gaps = db
            .create_gaps(debrief_id, &[("critical", "security", "No auth", "Why it matters", "Fix it")])
            .unwrap();
        assert!(!gaps[0].resolved);

        db.resolve_gap(gaps[0].id).unwrap();
        let updated = db.get_gaps_by_debrief(debrief_id).unwrap();
        assert!(updated[0].resolved);
    }

    #[test]
    fn test_count_by_project() {
        let (db, project_id, debrief_id) = setup_with_project();
        db.create_gaps(
            debrief_id,
            &[
                ("critical", "security", "No auth", "", ""),
                ("warning", "performance", "Slow query", "", ""),
            ],
        )
        .unwrap();
        let count = db.count_gaps_by_project(project_id).unwrap();
        assert_eq!(count, 2);
    }

    #[test]
    fn test_unresolved_filter() {
        let (db, project_id, debrief_id) = setup_with_project();
        let gaps = db
            .create_gaps(
                debrief_id,
                &[
                    ("critical", "security", "No auth", "", ""),
                    ("warning", "performance", "Slow query", "", ""),
                ],
            )
            .unwrap();
        db.resolve_gap(gaps[0].id).unwrap();

        let unresolved = db.get_unresolved_gaps_by_project(project_id).unwrap();
        assert_eq!(unresolved.len(), 1);
        assert_eq!(unresolved[0].description, "Slow query");
    }
}
