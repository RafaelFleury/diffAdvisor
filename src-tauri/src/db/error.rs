use thiserror::Error;

#[derive(Error, Debug)]
pub enum DbError {
    #[error("SQLite error: {0}")]
    SqliteError(#[from] rusqlite::Error),

    #[error("Record not found")]
    NotFound,

    #[error("JSON serialization error: {0}")]
    JsonError(#[from] serde_json::Error),

    #[error("Migration error: {0}")]
    MigrationError(String),
}

pub type DbResult<T> = Result<T, DbError>;
