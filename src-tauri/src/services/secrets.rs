use crate::db::Database;

const KEYRING_SERVICE: &str = "diffAdvisor";
const API_KEY_SETTING: &str = "ai.apiKey";

fn api_key_entry() -> keyring::Result<keyring::Entry> {
    keyring::Entry::new(KEYRING_SERVICE, API_KEY_SETTING)
}

/// Stores the API key in the OS keyring. Falls back to the settings table
/// when no keyring is available (e.g. Linux without a secret service).
pub fn store_api_key(db: &Database, api_key: &str) -> Result<(), String> {
    let keyring_result = api_key_entry().and_then(|entry| {
        if api_key.is_empty() {
            match entry.delete_credential() {
                Err(keyring::Error::NoEntry) => Ok(()),
                other => other,
            }
        } else {
            entry.set_password(api_key)
        }
    });

    let db_value = match keyring_result {
        Ok(()) => "",
        Err(e) => {
            eprintln!("[secrets] keyring unavailable, storing API key in database: {}", e);
            api_key
        }
    };

    db.set_setting(API_KEY_SETTING, db_value)
        .map_err(|e| format!("Failed to set {}: {}", API_KEY_SETTING, e))
}

/// Loads the API key, migrating any plaintext key left in the settings table
/// into the keyring.
pub fn load_api_key(db: &Database) -> String {
    let db_value = db
        .get_setting(API_KEY_SETTING)
        .ok()
        .flatten()
        .unwrap_or_default();

    if !db_value.is_empty() {
        let _ = store_api_key(db, &db_value);
        return db_value;
    }

    api_key_entry()
        .and_then(|entry| entry.get_password())
        .unwrap_or_default()
}
