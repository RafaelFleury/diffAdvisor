use rusqlite::params;

use super::error::{DbError, DbResult};
use super::models::Project;
use super::Database;

impl Database {
    pub fn create_project(
        &self,
        name: &str,
        path: &str,
        language: &str,
        frameworks: &[String],
        active_skills: &[String],
    ) -> DbResult<Project> {
        let conn = self.conn();
        let frameworks_json = serde_json::to_string(frameworks)?;
        let skills_json = serde_json::to_string(active_skills)?;

        conn.execute(
            "INSERT INTO projects (name, path, language, frameworks, active_skills) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![name, path, language, frameworks_json, skills_json],
        )?;

        let id = conn.last_insert_rowid();
        drop(conn);
        self.get_project(id)
    }

    pub fn get_project(&self, id: i64) -> DbResult<Project> {
        let conn = self.conn();
        conn.query_row(
            "SELECT id, name, path, language, frameworks, active_skills, created_at, last_analyzed_at FROM projects WHERE id = ?1",
            params![id],
            |row| Ok(Self::row_to_project(row)),
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => DbError::NotFound,
            _ => DbError::SqliteError(e),
        })
    }

    pub fn get_project_by_path(&self, path: &str) -> DbResult<Option<Project>> {
        let conn = self.conn();
        let result = conn.query_row(
            "SELECT id, name, path, language, frameworks, active_skills, created_at, last_analyzed_at FROM projects WHERE path = ?1",
            params![path],
            |row| Ok(Self::row_to_project(row)),
        );
        match result {
            Ok(project) => Ok(Some(project)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(DbError::SqliteError(e)),
        }
    }

    pub fn list_projects(&self) -> DbResult<Vec<Project>> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            "SELECT id, name, path, language, frameworks, active_skills, created_at, last_analyzed_at FROM projects ORDER BY created_at DESC",
        )?;
        let rows = stmt.query_map([], |row| Ok(Self::row_to_project(row)))?;
        let mut projects = Vec::new();
        for row in rows {
            projects.push(row?);
        }
        Ok(projects)
    }

    pub fn update_project(
        &self,
        id: i64,
        name: &str,
        language: &str,
        frameworks: &[String],
    ) -> DbResult<()> {
        let conn = self.conn();
        let frameworks_json = serde_json::to_string(frameworks)?;
        let rows = conn.execute(
            "UPDATE projects SET name = ?1, language = ?2, frameworks = ?3 WHERE id = ?4",
            params![name, language, frameworks_json, id],
        )?;
        if rows == 0 {
            return Err(DbError::NotFound);
        }
        Ok(())
    }

    pub fn update_project_skills(&self, id: i64, skills: &[String]) -> DbResult<()> {
        let conn = self.conn();
        let skills_json = serde_json::to_string(skills)?;
        let rows = conn.execute(
            "UPDATE projects SET active_skills = ?1 WHERE id = ?2",
            params![skills_json, id],
        )?;
        if rows == 0 {
            return Err(DbError::NotFound);
        }
        Ok(())
    }

    pub fn update_project_last_analyzed(&self, id: i64) -> DbResult<()> {
        let conn = self.conn();
        let rows = conn.execute(
            "UPDATE projects SET last_analyzed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?1",
            params![id],
        )?;
        if rows == 0 {
            return Err(DbError::NotFound);
        }
        Ok(())
    }

    pub fn delete_project(&self, id: i64) -> DbResult<()> {
        let conn = self.conn();
        let rows = conn.execute("DELETE FROM projects WHERE id = ?1", params![id])?;
        if rows == 0 {
            return Err(DbError::NotFound);
        }
        Ok(())
    }

    fn row_to_project(row: &rusqlite::Row) -> Project {
        let frameworks_str: String = row.get(4).unwrap_or_default();
        let skills_str: String = row.get(5).unwrap_or_default();
        Project {
            id: row.get(0).unwrap(),
            name: row.get(1).unwrap(),
            path: row.get(2).unwrap(),
            language: row.get(3).unwrap_or_default(),
            frameworks: serde_json::from_str(&frameworks_str).unwrap_or_default(),
            active_skills: serde_json::from_str(&skills_str).unwrap_or_default(),
            created_at: row.get(6).unwrap(),
            last_analyzed_at: row.get(7).unwrap_or(None),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup() -> Database {
        Database::open_in_memory().unwrap()
    }

    #[test]
    fn test_create_project() {
        let db = setup();
        let project = db
            .create_project("Test", "/tmp/test", "typescript", &["react".into()], &["security".into()])
            .unwrap();
        assert_eq!(project.name, "Test");
        assert_eq!(project.path, "/tmp/test");
        assert_eq!(project.language, "typescript");
        assert_eq!(project.frameworks, vec!["react"]);
        assert_eq!(project.active_skills, vec!["security"]);
        assert!(project.last_analyzed_at.is_none());
    }

    #[test]
    fn test_duplicate_path_error() {
        let db = setup();
        db.create_project("Test1", "/tmp/test", "ts", &[], &[]).unwrap();
        let result = db.create_project("Test2", "/tmp/test", "ts", &[], &[]);
        assert!(result.is_err());
    }

    #[test]
    fn test_get_project_not_found() {
        let db = setup();
        let result = db.get_project(9999);
        assert!(matches!(result, Err(DbError::NotFound)));
    }

    #[test]
    fn test_list_empty() {
        let db = setup();
        let projects = db.list_projects().unwrap();
        assert!(projects.is_empty());
    }

    #[test]
    fn test_list_multiple() {
        let db = setup();
        db.create_project("P1", "/tmp/p1", "ts", &[], &[]).unwrap();
        db.create_project("P2", "/tmp/p2", "py", &[], &[]).unwrap();
        let projects = db.list_projects().unwrap();
        assert_eq!(projects.len(), 2);
    }

    #[test]
    fn test_get_project_by_path() {
        let db = setup();
        db.create_project("Test", "/tmp/test", "ts", &[], &[]).unwrap();
        let found = db.get_project_by_path("/tmp/test").unwrap();
        assert!(found.is_some());
        let not_found = db.get_project_by_path("/tmp/nonexistent").unwrap();
        assert!(not_found.is_none());
    }

    #[test]
    fn test_update_project_skills() {
        let db = setup();
        let project = db.create_project("Test", "/tmp/test", "ts", &[], &[]).unwrap();
        db.update_project_skills(project.id, &["react".into(), "security".into()])
            .unwrap();
        let updated = db.get_project(project.id).unwrap();
        assert_eq!(updated.active_skills, vec!["react", "security"]);
    }

    #[test]
    fn test_update_project_last_analyzed() {
        let db = setup();
        let project = db.create_project("Test", "/tmp/test", "ts", &[], &[]).unwrap();
        assert!(project.last_analyzed_at.is_none());
        db.update_project_last_analyzed(project.id).unwrap();
        let updated = db.get_project(project.id).unwrap();
        assert!(updated.last_analyzed_at.is_some());
    }

    #[test]
    fn test_delete_project() {
        let db = setup();
        let project = db.create_project("Test", "/tmp/test", "ts", &[], &[]).unwrap();
        db.delete_project(project.id).unwrap();
        let result = db.get_project(project.id);
        assert!(matches!(result, Err(DbError::NotFound)));
    }

    #[test]
    fn test_delete_cascades_to_debriefs() {
        let db = setup();
        let project = db.create_project("Test", "/tmp/test", "ts", &[], &[]).unwrap();
        db.create_debrief(project.id, "abc123", "test commit", "diff", None, &[])
            .unwrap();
        db.delete_project(project.id).unwrap();
        let debriefs = db.list_debriefs_by_project(project.id).unwrap();
        assert!(debriefs.is_empty());
    }
}
