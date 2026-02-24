use std::sync::{Arc, Mutex};

use crate::db::Database;
use notify::RecommendedWatcher;

pub struct AppState {
    pub db: Arc<Mutex<Database>>,
    pub watcher: Mutex<Option<RecommendedWatcher>>,
}

impl AppState {
    pub fn new(db: Database) -> Self {
        Self {
            db: Arc::new(Mutex::new(db)),
            watcher: Mutex::new(None),
        }
    }

    pub fn db(&self) -> std::sync::MutexGuard<'_, Database> {
        self.db.lock().expect("AppState database mutex poisoned")
    }

    pub fn set_watcher(&self, watcher: Option<RecommendedWatcher>) {
        let mut guard = self.watcher.lock().expect("Watcher mutex poisoned");
        *guard = watcher;
    }
}
