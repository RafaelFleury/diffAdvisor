use rusqlite::params;

use super::error::{DbError, DbResult};
use super::models::Setting;
use super::Database;

impl Database {
    pub fn get_setting(&self, key: &str) -> DbResult<Option<String>> {
        let conn = self.conn();
        let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
        let result = stmt.query_row(params![key], |row| row.get::<_, String>(0));
        match result {
            Ok(value) => Ok(Some(value)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(DbError::SqliteError(e)),
        }
    }

    pub fn set_setting(&self, key: &str, value: &str) -> DbResult<()> {
        let conn = self.conn();
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            params![key, value],
        )?;
        Ok(())
    }

    pub fn get_all_settings(&self) -> DbResult<Vec<Setting>> {
        let conn = self.conn();
        let mut stmt = conn.prepare("SELECT key, value FROM settings ORDER BY key")?;
        let rows = stmt.query_map([], |row| {
            Ok(Setting {
                key: row.get(0)?,
                value: row.get(1)?,
            })
        })?;
        let mut settings = Vec::new();
        for row in rows {
            settings.push(row?);
        }
        Ok(settings)
    }

    pub fn delete_setting(&self, key: &str) -> DbResult<()> {
        let conn = self.conn();
        conn.execute("DELETE FROM settings WHERE key = ?1", params![key])?;
        Ok(())
    }

    pub fn get_app_settings(&self) -> DbResult<String> {
        let settings = self.get_all_settings()?;
        let mut map = serde_json::Map::new();
        for s in settings {
            let parts: Vec<&str> = s.key.splitn(2, '.').collect();
            let value = Self::parse_setting_value(&s.value);
            if parts.len() == 2 {
                let section = map
                    .entry(parts[0].to_string())
                    .or_insert_with(|| serde_json::Value::Object(serde_json::Map::new()));
                if let serde_json::Value::Object(ref mut obj) = section {
                    obj.insert(parts[1].to_string(), value);
                }
            } else {
                map.insert(s.key, value);
            }
        }
        Ok(serde_json::to_string(&map)?)
    }

    /// Parse a setting value string into the appropriate JSON type.
    /// "true"/"false" → bool, otherwise → string.
    fn parse_setting_value(value: &str) -> serde_json::Value {
        match value {
            "true" => serde_json::Value::Bool(true),
            "false" => serde_json::Value::Bool(false),
            _ => serde_json::Value::String(value.to_string()),
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
    fn test_set_and_get_setting() {
        let db = setup();
        db.set_setting("test.key", "test_value").unwrap();
        let val = db.get_setting("test.key").unwrap();
        assert_eq!(val, Some("test_value".to_string()));
    }

    #[test]
    fn test_upsert_setting() {
        let db = setup();
        db.set_setting("test.key", "value1").unwrap();
        db.set_setting("test.key", "value2").unwrap();
        let val = db.get_setting("test.key").unwrap();
        assert_eq!(val, Some("value2".to_string()));
    }

    #[test]
    fn test_missing_setting_returns_none() {
        let db = setup();
        let val = db.get_setting("nonexistent.key").unwrap();
        assert_eq!(val, None);
    }

    #[test]
    fn test_defaults_seeded() {
        let db = setup();
        let theme = db.get_setting("appearance.theme").unwrap();
        assert_eq!(theme, Some("dark".to_string()));

        let model = db.get_setting("ai.model").unwrap();
        assert_eq!(model, Some("gpt-4.1".to_string()));
    }

    #[test]
    fn test_get_all_settings() {
        let db = setup();
        let settings = db.get_all_settings().unwrap();
        assert!(!settings.is_empty());
        assert!(settings.iter().any(|s| s.key == "appearance.theme"));
    }

    #[test]
    fn test_delete_setting() {
        let db = setup();
        db.set_setting("temp.key", "temp_value").unwrap();
        db.delete_setting("temp.key").unwrap();
        let val = db.get_setting("temp.key").unwrap();
        assert_eq!(val, None);
    }

    #[test]
    fn test_get_app_settings_json() {
        let db = setup();
        let json_str = db.get_app_settings().unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json_str).unwrap();
        assert_eq!(parsed["appearance"]["theme"].as_str(), Some("dark"));
        assert_eq!(parsed["appearance"]["debriefLanguage"].as_str(), Some("english"));
        assert_eq!(parsed["ai"]["model"].as_str(), Some("gpt-4.1"));
        assert_eq!(parsed["ai"]["webSearch"].as_bool(), Some(false));
        assert_eq!(parsed["analysis"]["analysisDepth"].as_str(), Some("balanced"));
        assert_eq!(parsed["analysis"]["autoAnalyze"].as_bool(), Some(false));
        assert_eq!(parsed["project"]["monitoredDirectory"].as_str(), Some(""));
        assert_eq!(parsed["project"]["fileExtensions"].as_str(), Some(".ts,.tsx,.js,.jsx,.py,.rs,.go,.java"));
        assert_eq!(parsed["project"]["hasGitignore"].as_bool(), Some(false));
        assert_eq!(parsed["knowledge"]["autoGenerateNotes"].as_bool(), Some(false));
    }
}
