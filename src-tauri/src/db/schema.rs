use rusqlite::Connection;

use super::error::{DbError, DbResult};

const CURRENT_VERSION: i32 = 1;

pub fn run_migrations(conn: &Connection) -> DbResult<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_version (
            version INTEGER NOT NULL
        );"
    ).map_err(|e| DbError::MigrationError(e.to_string()))?;

    let version: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_version",
            [],
            |row| row.get(0),
        )
        .map_err(|e| DbError::MigrationError(e.to_string()))?;

    if version < 1 {
        migration_001(conn)?;
    }

    if version < CURRENT_VERSION {
        conn.execute(
            "INSERT INTO schema_version (version) VALUES (?1)",
            [CURRENT_VERSION],
        )
        .map_err(|e| DbError::MigrationError(e.to_string()))?;
    }

    Ok(())
}

fn migration_001(conn: &Connection) -> DbResult<()> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            path TEXT NOT NULL UNIQUE,
            language TEXT NOT NULL DEFAULT '',
            frameworks TEXT NOT NULL DEFAULT '[]',
            active_skills TEXT NOT NULL DEFAULT '[]',
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            last_analyzed_at TEXT
        );

        CREATE TABLE IF NOT EXISTS debriefs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            commit_hash TEXT NOT NULL,
            commit_message TEXT NOT NULL DEFAULT '',
            diff_content TEXT NOT NULL DEFAULT '',
            ai_response_json TEXT,
            skills_used TEXT NOT NULL DEFAULT '[]',
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS checkpoint_responses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            debrief_id INTEGER NOT NULL,
            question_id TEXT NOT NULL DEFAULT '',
            question_text TEXT NOT NULL,
            response_text TEXT NOT NULL DEFAULT '',
            ai_evaluation_json TEXT,
            mode TEXT NOT NULL DEFAULT 'free_text',
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            FOREIGN KEY (debrief_id) REFERENCES debriefs(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS gaps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            debrief_id INTEGER NOT NULL,
            severity TEXT NOT NULL DEFAULT 'info',
            category TEXT NOT NULL DEFAULT 'maintainability',
            description TEXT NOT NULL DEFAULT '',
            resolved INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            FOREIGN KEY (debrief_id) REFERENCES debriefs(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS knowledge_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER,
            title TEXT NOT NULL,
            category_path TEXT NOT NULL DEFAULT '',
            file_path TEXT NOT NULL DEFAULT '',
            auto_generated INTEGER NOT NULL DEFAULT 0,
            tags TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL DEFAULT ''
        );

        CREATE INDEX IF NOT EXISTS idx_debriefs_project_id ON debriefs(project_id);
        CREATE INDEX IF NOT EXISTS idx_debriefs_commit_hash ON debriefs(commit_hash);
        CREATE INDEX IF NOT EXISTS idx_debriefs_status ON debriefs(status);
        CREATE INDEX IF NOT EXISTS idx_gaps_debrief_id ON gaps(debrief_id);
        CREATE INDEX IF NOT EXISTS idx_gaps_severity ON gaps(severity);
        CREATE INDEX IF NOT EXISTS idx_checkpoint_responses_debrief_id ON checkpoint_responses(debrief_id);
        CREATE INDEX IF NOT EXISTS idx_knowledge_notes_project_id ON knowledge_notes(project_id);
        ",
    )
    .map_err(|e| DbError::MigrationError(e.to_string()))?;

    seed_default_settings(conn)?;

    Ok(())
}

fn seed_default_settings(conn: &Connection) -> DbResult<()> {
    let defaults = vec![
        ("project.monitoredPath", ""),
        ("project.extensions", ".ts,.tsx,.js,.jsx,.py,.rs,.go,.java"),
        ("project.ignoredPaths", "node_modules,.git,dist,__pycache__,target"),
        ("ai.endpointUrl", "https://api.openai.com/v1"),
        ("ai.model", "gpt-4.1"),
        ("ai.apiKey", ""),
        ("ai.webSearch", "false"),
        ("analysis.autoAnalyze", "false"),
        ("analysis.checkpointMode", "free_text"),
        ("analysis.depth", "balanced"),
        ("knowledge.storagePath", "~/knowledge_base"),
        ("knowledge.autoGenerate", "false"),
        ("appearance.theme", "dark"),
        ("appearance.language", "en"),
    ];

    let mut stmt = conn
        .prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?1, ?2)")
        .map_err(|e| DbError::MigrationError(e.to_string()))?;

    for (key, value) in defaults {
        stmt.execute(rusqlite::params![key, value])
            .map_err(|e| DbError::MigrationError(e.to_string()))?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_migrations_idempotent() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();

        run_migrations(&conn).unwrap();
        run_migrations(&conn).unwrap();

        let version: i32 = conn
            .query_row("SELECT MAX(version) FROM schema_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, CURRENT_VERSION);
    }

    #[test]
    fn test_foreign_keys_enforced() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        run_migrations(&conn).unwrap();

        let result = conn.execute(
            "INSERT INTO debriefs (project_id, commit_hash) VALUES (9999, 'abc123')",
            [],
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_default_settings_seeded() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        run_migrations(&conn).unwrap();

        let count: i32 = conn
            .query_row("SELECT COUNT(*) FROM settings", [], |row| row.get(0))
            .unwrap();
        assert!(count > 0);

        let theme: String = conn
            .query_row(
                "SELECT value FROM settings WHERE key = 'appearance.theme'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(theme, "dark");
    }
}
