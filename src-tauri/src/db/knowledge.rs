use rusqlite::params;

use super::error::{DbError, DbResult};
use super::models::KnowledgeNote;
use super::Database;

impl Database {
    pub fn create_knowledge_note(
        &self,
        project_id: Option<i64>,
        title: &str,
        category_path: &str,
        file_path: &str,
        auto_generated: bool,
        tags: &str,
    ) -> DbResult<KnowledgeNote> {
        let conn = self.conn();
        conn.execute(
            "INSERT INTO knowledge_notes (project_id, title, category_path, file_path, auto_generated, tags) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![project_id, title, category_path, file_path, auto_generated as i32, tags],
        )?;
        let id = conn.last_insert_rowid();
        drop(conn);
        self.get_knowledge_note(id)
    }

    pub fn get_knowledge_note(&self, id: i64) -> DbResult<KnowledgeNote> {
        let conn = self.conn();
        conn.query_row(
            "SELECT id, project_id, title, category_path, file_path, auto_generated, tags, created_at, updated_at FROM knowledge_notes WHERE id = ?1",
            params![id],
            |row| Ok(Self::row_to_knowledge_note(row)),
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => DbError::NotFound,
            _ => DbError::SqliteError(e),
        })
    }

    pub fn list_knowledge_notes(&self) -> DbResult<Vec<KnowledgeNote>> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, title, category_path, file_path, auto_generated, tags, created_at, updated_at FROM knowledge_notes ORDER BY updated_at DESC",
        )?;
        let rows = stmt.query_map([], |row| Ok(Self::row_to_knowledge_note(row)))?;
        let mut notes = Vec::new();
        for row in rows {
            notes.push(row?);
        }
        Ok(notes)
    }

    pub fn search_knowledge_notes(&self, query: &str) -> DbResult<Vec<KnowledgeNote>> {
        let conn = self.conn();
        let pattern = format!("%{}%", query);
        let mut stmt = conn.prepare(
            "SELECT id, project_id, title, category_path, file_path, auto_generated, tags, created_at, updated_at
             FROM knowledge_notes
             WHERE title LIKE ?1 OR tags LIKE ?1 OR category_path LIKE ?1
             ORDER BY updated_at DESC",
        )?;
        let rows = stmt.query_map(params![pattern], |row| {
            Ok(Self::row_to_knowledge_note(row))
        })?;
        let mut notes = Vec::new();
        for row in rows {
            notes.push(row?);
        }
        Ok(notes)
    }

    pub fn update_knowledge_note(
        &self,
        id: i64,
        title: &str,
        category_path: &str,
        file_path: &str,
        tags: &str,
    ) -> DbResult<()> {
        let conn = self.conn();
        let rows = conn.execute(
            "UPDATE knowledge_notes SET title = ?1, category_path = ?2, file_path = ?3, tags = ?4, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?5",
            params![title, category_path, file_path, tags, id],
        )?;
        if rows == 0 {
            return Err(DbError::NotFound);
        }
        Ok(())
    }

    pub fn delete_knowledge_note(&self, id: i64) -> DbResult<()> {
        let conn = self.conn();
        let rows = conn.execute("DELETE FROM knowledge_notes WHERE id = ?1", params![id])?;
        if rows == 0 {
            return Err(DbError::NotFound);
        }
        Ok(())
    }

    fn row_to_knowledge_note(row: &rusqlite::Row) -> KnowledgeNote {
        KnowledgeNote {
            id: row.get(0).unwrap(),
            project_id: row.get(1).unwrap_or(None),
            title: row.get(2).unwrap(),
            category_path: row.get(3).unwrap_or_default(),
            file_path: row.get(4).unwrap_or_default(),
            auto_generated: row.get::<_, i32>(5).unwrap_or(0) != 0,
            tags: row.get(6).unwrap_or_default(),
            created_at: row.get(7).unwrap(),
            updated_at: row.get(8).unwrap(),
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
    fn test_create_knowledge_note() {
        let db = setup();
        let note = db
            .create_knowledge_note(
                None,
                "JWT Authentication",
                "concepts/security",
                "/kb/concepts/security/JWT Authentication.md",
                true,
                "security,authentication,jwt",
            )
            .unwrap();
        assert_eq!(note.title, "JWT Authentication");
        assert_eq!(note.category_path, "concepts/security");
        assert!(note.auto_generated);
        assert!(note.project_id.is_none());
    }

    #[test]
    fn test_search_by_title() {
        let db = setup();
        db.create_knowledge_note(None, "JWT Authentication", "concepts/security", "/kb/jwt.md", true, "security")
            .unwrap();
        db.create_knowledge_note(None, "Rate Limiting", "concepts/security", "/kb/rate.md", true, "security")
            .unwrap();

        let results = db.search_knowledge_notes("JWT").unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].title, "JWT Authentication");
    }

    #[test]
    fn test_search_by_tag() {
        let db = setup();
        db.create_knowledge_note(None, "JWT Auth", "security", "/kb/jwt.md", true, "security,auth")
            .unwrap();
        db.create_knowledge_note(None, "React Hooks", "frontend", "/kb/hooks.md", false, "react,frontend")
            .unwrap();

        let results = db.search_knowledge_notes("react").unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].title, "React Hooks");
    }

    #[test]
    fn test_update_knowledge_note() {
        let db = setup();
        let note = db
            .create_knowledge_note(None, "Old Title", "old/path", "/kb/old.md", false, "tag1")
            .unwrap();
        db.update_knowledge_note(note.id, "New Title", "new/path", "/kb/new.md", "tag1,tag2")
            .unwrap();
        let updated = db.get_knowledge_note(note.id).unwrap();
        assert_eq!(updated.title, "New Title");
        assert_eq!(updated.category_path, "new/path");
        assert_eq!(updated.tags, "tag1,tag2");
    }

    #[test]
    fn test_delete_knowledge_note() {
        let db = setup();
        let note = db
            .create_knowledge_note(None, "To Delete", "path", "/kb/del.md", false, "")
            .unwrap();
        db.delete_knowledge_note(note.id).unwrap();
        let result = db.get_knowledge_note(note.id);
        assert!(matches!(result, Err(DbError::NotFound)));
    }

    #[test]
    fn test_list_knowledge_notes() {
        let db = setup();
        db.create_knowledge_note(None, "Note 1", "cat1", "/kb/1.md", false, "").unwrap();
        db.create_knowledge_note(None, "Note 2", "cat2", "/kb/2.md", true, "").unwrap();
        let notes = db.list_knowledge_notes().unwrap();
        assert_eq!(notes.len(), 2);
    }
}
