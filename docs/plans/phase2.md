# Phase 2: Database Layer — Implementation Plan

## Context

Phase 1 built the complete React frontend with mock data. Phase 2 builds the SQLite database layer in Rust — independent of Tauri IPC (that's Phase 3). The project currently has no `src-tauri/` directory. This phase scaffolds Tauri 2 and implements all CRUD operations with tests.

**Outcome:** A compilable Tauri 2 project with a standalone, fully-tested SQLite database module. All tables created, all CRUD operations working, ~40 unit tests passing via `cargo test`.

---

## Step 1: Scaffold Tauri 2

- Install `@tauri-apps/cli` and run `pnpm tauri init` to create `src-tauri/`
- Configure `tauri.conf.json`: devUrl `http://localhost:5173`, frontendDist `../dist`
- Update `vite.config.ts` with Tauri settings (`clearScreen: false`, `server.strictPort: true`, `envPrefix: ['VITE_', 'TAURI_']`)
- Add Cargo dependencies: `rusqlite` (bundled), `serde`/`serde_json`, `chrono`, `thiserror`, `tempfile` (dev)
- Create directory structure:

```
src-tauri/src/
├── main.rs           # Minimal Tauri app builder, no commands yet
├── lib.rs            # Module declarations
├── db/
│   ├── mod.rs        # Database struct, open, migration runner
│   ├── error.rs      # DbError enum, DbResult alias
│   ├── schema.rs     # Migration SQL strings
│   ├── models.rs     # Rust structs for all tables
│   ├── projects.rs   # Project CRUD
│   ├── debriefs.rs   # Debrief CRUD
│   ├── gaps.rs       # Gap CRUD
│   ├── checkpoints.rs # Checkpoint response CRUD
│   ├── knowledge.rs  # Knowledge note CRUD
│   └── settings.rs   # Settings key-value CRUD
├── commands/
│   └── mod.rs        # Empty placeholder (Phase 3)
└── services/
    └── mod.rs        # Empty placeholder (Phase 3)
```

## Step 2: Database Foundation

### Error types (`db/error.rs`)
- `DbError` enum: `SqliteError`, `NotFound`, `JsonError`, `MigrationError`
- Implement `From<rusqlite::Error>`, `From<serde_json::Error>`
- Type alias `DbResult<T> = Result<T, DbError>`

### Database struct (`db/mod.rs`)
```rust
pub struct Database {
    conn: Mutex<rusqlite::Connection>,  // Mutex for future thread safety
}
```
- `Database::open(path)` — opens file, enables WAL + foreign keys, runs migrations
- `Database::open_in_memory()` — for tests
- Default DB location: `~/.diffadvisor/data.db` (resolved by caller)

### Schema (`db/schema.rs`)
Versioned migrations via a `schema_version` table. Migration 1 creates all tables:

**Tables:**
- `projects` — id, name, path (UNIQUE), language, frameworks (JSON), active_skills (JSON), created_at, last_analyzed_at
- `debriefs` — id, project_id (FK CASCADE), commit_hash, commit_message, diff_content, ai_response_json, skills_used (JSON), status, created_at
- `checkpoint_responses` — id, debrief_id (FK CASCADE), question_id, question_text, response_text, ai_evaluation_json, mode, created_at
- `gaps` — id, debrief_id (FK CASCADE), severity, category, description, resolved, created_at
- `knowledge_notes` — id, project_id (FK SET NULL), title, category_path, file_path, auto_generated, tags, created_at, updated_at
- `settings` — key (PK), value

**Indexes** on: debriefs(project_id, commit_hash, status), gaps(debrief_id, severity), checkpoint_responses(debrief_id), knowledge_notes(project_id)

**Default settings** seeded after migration (project, ai, analysis, knowledge, appearance sections).

### Models (`db/models.rs`)
Rust structs with `#[derive(Serialize, Deserialize)]` and `#[serde(rename_all = "camelCase")]`:
- `Project`, `Debrief`, `Gap`, `CheckpointResponse`, `KnowledgeNote`, `Setting`

**Key design decisions:**
- IDs are `i64` in DB (natural for SQLite autoincrement). Phase 3 converts to `String` for frontend.
- Datetimes stored as ISO 8601 TEXT strings — matches frontend expectations.
- JSON arrays (frameworks, skills, tags) stored as TEXT, serde handles conversion.
- `Gap` in DB has only description + resolved. Full details (explanation, suggestion) live in `ai_response_json`. Phase 3 merges them.
- `KnowledgeNote` has no `content` field — content is .md files on disk. DB is an index.
- Added `question_id` to `checkpoint_responses` (missing from spec but required by frontend type).
- No `commits` table — commit status is derived from debrief existence/status. Git is the source of truth for commit metadata.

## Step 3: CRUD Operations

### Projects (`db/projects.rs`) — 8 functions
- `create_project(name, path, language, frameworks, active_skills) -> Project`
- `get_project(id) -> Project`
- `get_project_by_path(path) -> Option<Project>`
- `list_projects() -> Vec<Project>`
- `update_project(id, name, language, frameworks)`
- `update_project_skills(id, skills)`
- `update_project_last_analyzed(id)`
- `delete_project(id)`

### Debriefs (`db/debriefs.rs`) — 6 functions
- `create_debrief(project_id, commit_hash, commit_message, diff_content, ai_response_json, skills_used) -> Debrief`
- `get_debrief(id) -> Debrief`
- `get_debrief_by_commit(commit_hash) -> Option<Debrief>`
- `list_debriefs_by_project(project_id) -> Vec<Debrief>`
- `list_debriefs_by_status(project_id, status) -> Vec<Debrief>`
- `mark_debrief_reviewed(id)`

### Gaps (`db/gaps.rs`) — 5 functions
- `create_gaps(debrief_id, gaps_data) -> Vec<Gap>` (batch insert)
- `get_gaps_by_debrief(debrief_id) -> Vec<Gap>`
- `get_unresolved_gaps_by_project(project_id) -> Vec<Gap>` (joins debriefs)
- `count_gaps_by_project(project_id) -> i64`
- `resolve_gap(id)`

### Checkpoints (`db/checkpoints.rs`) — 3 functions
- `create_checkpoint_response(debrief_id, question_id, question_text, response_text, mode) -> CheckpointResponse`
- `get_checkpoint_responses(debrief_id) -> Vec<CheckpointResponse>`
- `update_checkpoint_evaluation(id, ai_evaluation_json)`

### Knowledge (`db/knowledge.rs`) — 6 functions
- `create_knowledge_note(project_id, title, category_path, file_path, auto_generated, tags) -> KnowledgeNote`
- `get_knowledge_note(id) -> KnowledgeNote`
- `list_knowledge_notes() -> Vec<KnowledgeNote>`
- `search_knowledge_notes(query) -> Vec<KnowledgeNote>` (LIKE on title, tags, category_path)
- `update_knowledge_note(id, title, category_path, file_path, tags)`
- `delete_knowledge_note(id)`

### Settings (`db/settings.rs`) — 5 functions
- `get_setting(key) -> Option<String>`
- `set_setting(key, value)` (INSERT OR REPLACE)
- `get_all_settings() -> Vec<Setting>`
- `delete_setting(key)`
- `get_app_settings() -> String` (assembles full AppSettings JSON from individual keys)

## Step 4: Tests (~40 unit tests)

Each CRUD file has `#[cfg(test)] mod tests` using `Database::open_in_memory()`.

**projects.rs** — create, duplicate path error, not found, list empty, list multiple, update skills, update last analyzed, delete, cascade to debriefs

**debriefs.rs** — create, get by commit, get by commit not found, list by project, list by status, mark reviewed, cascade to gaps/checkpoints

**gaps.rs** — batch create, resolve, count by project, unresolved filter

**checkpoints.rs** — create response, get by debrief, update evaluation

**knowledge.rs** — create note, search by title, search by tag, update, delete

**settings.rs** — set/get, upsert, missing returns None, defaults seeded, get all

**schema.rs** — migrations idempotent, foreign keys enforced

**Integration test** (`src-tauri/tests/db_integration.rs`) — full workflow: create project → create debrief → create gaps → create checkpoint responses → mark reviewed → resolve gap → create knowledge note → save settings → verify reads → delete project → verify cascade

## Step 5: Verify

- `cd src-tauri && cargo test` — all tests pass
- `cd src-tauri && cargo build` — compiles cleanly
- `pnpm build` — frontend still builds (no regressions)

---

## Implementation Order

1. Scaffold Tauri 2, get `cargo build` working
2. `error.rs` → `schema.rs` → `mod.rs` (Database struct) → `models.rs`
3. `settings.rs` + tests (simplest, validates pipeline)
4. `projects.rs` + tests
5. `debriefs.rs` + tests
6. `gaps.rs` + tests
7. `checkpoints.rs` + tests
8. `knowledge.rs` + tests
9. Integration test
10. Final verification
