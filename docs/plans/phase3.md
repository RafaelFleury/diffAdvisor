# Phase 3 Implementation Plan — diffAdvisor

## Context

Phase 1 built the full React frontend with mock data and service interfaces. Phase 2 built the SQLite database layer (6 tables, 53 tests, migration_001). Phase 3 connects them: implement Rust services (git, AI, context assembly, skills, knowledge base, file watcher) + Tauri IPC commands + wire up the frontend TauriService.

The result is a fully functional MVP where the app monitors a git project, detects new commits, calls an OpenAI-compatible LLM, and generates educational debriefs.

---

## Files to Create / Modify

### New Rust files
- `src-tauri/src/state.rs` — AppState struct
- `src-tauri/src/services/git.rs` — git CLI wrapper
- `src-tauri/src/services/ai.rs` — HTTP LLM client
- `src-tauri/src/services/context.rs` — context assembly
- `src-tauri/src/services/skills.rs` — skill loading & detection
- `src-tauri/src/services/knowledge.rs` — KB file operations
- `src-tauri/src/services/watcher.rs` — file system watcher
- `src-tauri/src/commands/projects.rs`
- `src-tauri/src/commands/debriefs.rs`
- `src-tauri/src/commands/checkpoints.rs`
- `src-tauri/src/commands/knowledge.rs`
- `src-tauri/src/commands/settings.rs`
- `src-tauri/skills/` — 7 built-in skill markdown files

### Modified Rust files
- `src-tauri/Cargo.toml` — add reqwest, tokio, notify, serde_yaml
- `src-tauri/src/db/schema.rs` — add migration_002
- `src-tauri/src/db/models.rs` — update Gap, KnowledgeNote structs
- `src-tauri/src/db/gaps.rs` — add explanation + suggestion params
- `src-tauri/src/db/knowledge.rs` — add source_debrief_id, source_commit, links_to params
- `src-tauri/src/services/mod.rs` — declare all service submodules
- `src-tauri/src/commands/mod.rs` — declare all command submodules + pub use
- `src-tauri/src/lib.rs` — expose state, commands, services modules
- `src-tauri/src/main.rs` — init DB, build AppState, register all commands

### Modified Frontend files
- `src/services/tauri.ts` — implement all methods with `invoke()`
- `src/services/types.ts` — add `writeToKb` to IKnowledgeService

---

## Step 1 — Cargo.toml Dependencies

```toml
reqwest = { version = "0.12", features = ["json"] }
tokio = { version = "1", features = ["rt-multi-thread", "macros"] }
notify = "6"
serde_yaml = "0.9"
dirs = "5"
```

- `reqwest` — HTTP client for LLM API calls (async)
- `tokio` — async runtime (required by reqwest; Tauri 2 is tokio-based)
- `notify` — file system watcher for `.git/refs/heads/`
- `serde_yaml` — parse YAML frontmatter in skill `.md` files
- `dirs` — resolve `~/.diffAdvisor/` and `~/knowledge_base`

---

## Step 2 — DB Migration 002

Add to `src-tauri/src/db/schema.rs`:

```rust
const CURRENT_VERSION: i32 = 2;

// After `if version < 1 { migration_001(conn)?; }`
if version < 2 {
    migration_002(conn)?;
}
```

```rust
fn migration_002(conn: &Connection) -> DbResult<()> {
    conn.execute_batch("
        ALTER TABLE gaps ADD COLUMN explanation TEXT NOT NULL DEFAULT '';
        ALTER TABLE gaps ADD COLUMN suggestion TEXT NOT NULL DEFAULT '';
        ALTER TABLE knowledge_notes ADD COLUMN source_debrief_id INTEGER REFERENCES debriefs(id) ON DELETE SET NULL;
        ALTER TABLE knowledge_notes ADD COLUMN source_commit TEXT;
        ALTER TABLE knowledge_notes ADD COLUMN links_to TEXT NOT NULL DEFAULT '[]';
    ").map_err(|e| DbError::MigrationError(e.to_string()))?;
    Ok(())
}
```

Update `CURRENT_VERSION` from 1 to 2. The `INSERT INTO schema_version` block already handles writing the new version.

---

## Step 3 — DB Model Updates (`db/models.rs`)

Update `Gap` struct:
```rust
pub struct Gap {
    pub id: i64,
    pub debrief_id: i64,
    pub severity: String,
    pub category: String,
    pub description: String,
    pub explanation: String,   // NEW
    pub suggestion: String,    // NEW
    pub resolved: bool,
    pub created_at: String,
}
```

Update `KnowledgeNote` struct:
```rust
pub struct KnowledgeNote {
    // existing fields...
    pub source_debrief_id: Option<i64>,  // NEW
    pub source_commit: Option<String>,   // NEW
    pub links_to: String,                // NEW (JSON array)
}
```

---

## Step 4 — DB CRUD Updates

### `db/gaps.rs`
- `create_gaps(conn, debrief_id, gaps: &[(severity, category, description, explanation, suggestion)])` — add explanation + suggestion to INSERT
- `get_gaps_by_debrief` — add explanation + suggestion to SELECT

### `db/knowledge.rs`
- `create_knowledge_note(conn, ..., source_debrief_id, source_commit, links_to)` — add new columns to INSERT
- `update_knowledge_note` — add links_to to UPDATE
- All query functions — add new columns to SELECT

---

## Step 5 — `src-tauri/src/state.rs`

```rust
pub struct AppState {
    pub db: Arc<Mutex<Database>>,
}

impl AppState {
    pub fn new(db: Database) -> Self {
        Self { db: Arc::new(Mutex::new(db)) }
    }
}
```

---

## Step 6 — Services Implementation

### 6a. `services/git.rs`

Uses `std::process::Command` to call the git CLI. No native C bindings.

```rust
pub struct CommitInfo {
    pub hash: String,
    pub message: String,
    pub author: String,
    pub timestamp: String,  // ISO 8601
    pub files_changed: i32,
    pub additions: i32,
    pub deletions: i32,
}

pub fn is_git_repo(path: &str) -> bool
// checks Path::new(path).join(".git").exists()

pub fn list_recent_commits(repo_path: &str, limit: usize) -> Result<Vec<CommitInfo>, String>
// git log --format="%H|%s|%an|%aI" -N
// then for each hash: git diff --shortstat <hash>^..<hash> for stats
// handle initial commit (no parent) with: git show --stat <hash>

pub fn get_commit_diff(repo_path: &str, commit_hash: &str) -> Result<String, String>
// git diff <hash>^..<hash>
// for initial commit: git show <hash>

pub fn detect_project_language(repo_path: &str) -> (String, Vec<String>)
// Check for: package.json → JavaScript/TypeScript, requirements.txt → Python,
// Cargo.toml → Rust, go.mod → Go, pom.xml → Java
// Returns (language, frameworks[])

pub fn parse_diff_to_file_diffs(diff: &str) -> Vec<FileDiff>
// Parse unified diff format into FileDiff { file_name, diff, additions, deletions }
// Split on "diff --git" markers

pub struct FileDiff {
    pub file_name: String,
    pub diff: String,
    pub additions: i32,
    pub deletions: i32,
}
```

### 6b. `services/skills.rs`

```rust
pub struct SkillDetect {
    pub files: Vec<String>,
    pub content_patterns: Vec<String>,
    pub extensions: Vec<String>,
}

pub struct Skill {
    pub id: String,        // slugified name
    pub name: String,
    pub description: String,
    pub tags: Vec<String>,
    pub detect: SkillDetect,
    pub content: String,   // body without frontmatter
    pub built_in: bool,
}

pub fn ensure_skills_dir() -> Result<PathBuf, String>
// Creates ~/.diffAdvisor/skills/builtin/ and ~/.diffAdvisor/skills/user/ if absent
// Copies src-tauri/skills/*.md to builtin/ on first run (check if dir is empty)

pub fn load_all_skills() -> Result<Vec<Skill>, String>
// Loads from ~/.diffAdvisor/skills/builtin/ and ~/.diffAdvisor/skills/user/

pub fn parse_skill_file(content: &str, file_stem: &str, built_in: bool) -> Result<Skill, String>
// Split on first "---" boundaries to extract YAML frontmatter and body
// Parse frontmatter with serde_yaml

pub fn detect_skills_for_diff(
    skills: &[Skill],
    diff: &str,
    commit_message: &str,
    changed_files: &[String],
) -> Vec<(Skill, u32)>  // (skill, relevance_score)
// For each skill, score = files matches + min(3, content_pattern matches) + min(3, extension matches)
// Return skills with score >= 1, sorted by score desc
```

### 6c. `services/context.rs`

Implements the full context assembly algorithm from `llm-context-management.md`.

```rust
pub struct AssembledContext {
    pub system_message: String,
    pub user_message: String,
    pub active_skills: Vec<String>,  // skill names used
    pub context_reduction_log: Vec<String>,  // what was dropped and why
}

pub fn estimate_tokens(text: &str, is_code: bool) -> usize
// code: text.len() / 3.5 (chars per token)
// prose: text.len() / 4.0

pub fn build_project_structure(repo_path: &str, ignored_paths: &[&str]) -> String
// Walk directory max 3 levels deep, max 100 entries
// Format as plain indented tree (├── / └── / │)

pub fn assemble_system_message(
    base_prompt: &str,
    analysis_depth: &str,           // "quick"|"balanced"|"deep"
    checkpoint_mode: &str,          // "free_text"|"multiple_choice"
    manual_skills: &[&Skill],
    auto_skills: &[(Skill, u32)],   // (skill, relevance_score)
    token_budget: usize,            // 100_000
) -> (String, Vec<String>)          // (message, skills_used)
// Appends depth instructions, checkpoint format instructions, skill blocks
// Drops auto skills if over budget (lowest relevance first)

pub fn format_history_line(commit_hash: &str, commit_message: &str, gaps: &[String]) -> String
// "[a3f7c2d] Add user login — gaps: rate limiting missing, no input validation"

pub fn assemble_user_message(
    project_structure: &str,
    commit: &CommitInfo,
    history: &[String],
    diff: &str,
    system_tokens_used: usize,
) -> (String, Vec<String>)          // (message, context_reduction_log)
// Implements overflow cascade from rule 3.5:
// 1. Drop history if over budget
// 2. Reduce diff to 2k tokens from top-priority files only
// 3. Drop project structure
// Applies diff truncation (risk-aware file prioritization)
// Excludes binary/lock/minified files (500-char line heuristic)

pub fn truncate_diff_smart(diff: &str, token_budget: usize) -> (String, Vec<String>)
// Priority tiers: auth/security > config/deployment > API boundary > DB > rest
// Keep first+last 100 lines, collapse middle with [--- N lines omitted ---]
// Exclude: package-lock.json, yarn.lock, Cargo.lock, *.min.js, *.min.css
```

### 6d. `services/ai.rs`

```rust
pub struct AiConfig {
    pub endpoint_url: String,
    pub model: String,
    pub api_key: String,         // empty string for local models
    pub requires_output_cap: Option<u32>,  // persisted from previous calls
}

pub struct DebriefResponse {
    pub schema_version: u32,
    pub architectural_summary: String,
    pub patterns_identified: Vec<String>,
    pub decisions_made: Vec<Decision>,
    pub gaps: Vec<GapData>,
    pub checkpoint_questions: Vec<CheckpointQuestion>,
    pub suggested_notes: Vec<SuggestedNote>,
    pub context_reduction_log: Option<Vec<String>>,
}

pub struct EvaluationResponse {
    pub score: u8,
    pub feedback: String,
    pub key_points_covered: Vec<String>,
    pub key_points_missed: Vec<String>,
}

pub struct KbNoteResponse {
    pub title: String,
    pub content: String,        // Obsidian markdown body, no frontmatter
}

// Async functions — require Tokio runtime (Tauri 2 provides it)

pub async fn run_debrief(
    config: &AiConfig,
    system_message: &str,
    user_message: &str,
) -> Result<DebriefResponse, AiError>
// POST to {endpoint_url}/chat/completions
// response_format: { type: "json_object" }
// temperature: 0.3
// First attempt: no max_tokens
// If provider requires it: retry with max_completion_tokens: 16000 (or max_tokens: 16000)
// JSON parse → extraction fallback → retry once with "ONLY JSON" instruction

pub async fn evaluate_checkpoint(
    config: &AiConfig,
    question: &str,
    good_answer_includes: &str,
    user_answer: &str,
) -> Result<EvaluationResponse, AiError>
// Separate LLM call for free_text evaluation
// System: "Evaluate this answer..."
// Returns JSON: { score, feedback, key_points_covered, key_points_missed }

pub async fn generate_kb_note(
    config: &AiConfig,
    note_input: &KbNoteInput,
) -> Result<KbNoteResponse, AiError>
// 50k input cap profile
// System: Obsidian note generation instructions
// Returns JSON: { title, content }

pub async fn test_connection(config: &AiConfig) -> Result<bool, AiError>
// Minimal completion request to validate connection

// AiError variants: Timeout, RateLimit(retry_after), ServerError, NetworkError, ParseError, InvalidResponse
```

**Output cap persistence strategy:** After a failed first attempt, persist `ai.requiresOutputCap=max_completion_tokens:16000` (or `max_tokens:16000`) to settings so future calls skip the wasted first attempt.

**Timeout:** reqwest `.timeout(Duration::from_secs(120))` for debrief, `90s` for KB generation.

### 6e. `services/knowledge.rs`

```rust
pub struct NoteFrontmatter {
    pub title: String,
    pub tags: Vec<String>,
    pub category: String,
    pub source_project: String,
    pub source_commit: String,
    pub auto_generated: bool,
    pub created: String,         // YYYY-MM-DD
    pub updated: Option<String>, // YYYY-MM-DD
}

pub fn sanitize_filename(title: &str) -> String
// Strip: / \ : * ? " < > |
// Collapse multiple spaces, cap at 200 chars

pub fn ensure_kb_dir(kb_path: &Path, category: &str) -> Result<PathBuf, String>
// mkdir -p <kb_path>/<category>/

pub fn write_note_atomic(path: &Path, frontmatter: &NoteFrontmatter, content: &str) -> Result<(), String>
// Write to <path>.tmp, then rename to <path>.md
// Backup existing file to <path>.bak before overwrite

pub fn read_note(path: &Path) -> Result<String, String>

pub fn list_existing_note_titles(kb_path: &Path) -> Vec<(String, String)>
// Returns [(title, category_path)] for all .md files in the KB

pub fn find_existing_note(kb_path: &Path, title: &str) -> Option<PathBuf>
// Find by sanitized title match across all subdirectories

pub fn build_frontmatter_yaml(fm: &NoteFrontmatter) -> String
// Returns "---\ntitle: ...\n..." block
```

### 6f. `services/watcher.rs`

```rust
pub fn start_watcher(
    repo_path: String,
    app_handle: tauri::AppHandle,
) -> Result<notify::RecommendedWatcher, String>
// Watches <repo_path>/.git/refs/heads/ using notify crate
// On change: run git log -1 to get newest commit hash
// Emit Tauri event: app_handle.emit("commit_detected", commit_hash)
// Use notify::recommended_watcher with RecursiveMode::NonRecursive
```

---

## Step 7 — Tauri Commands

### `commands/projects.rs`

```rust
#[tauri::command]
pub async fn add_project(state: State<'_, AppState>, path: String) -> Result<ProjectDto, String>
// Validate path exists and is git repo (is_git_repo)
// Detect language and frameworks (detect_project_language)
// DB: create_project
// Returns ProjectDto (camelCase JSON)

#[tauri::command]
pub async fn list_projects(state: State<'_, AppState>) -> Result<Vec<ProjectDto>, String>

#[tauri::command]
pub async fn remove_project(state: State<'_, AppState>, project_id: i64) -> Result<(), String>
// DB: delete_project

#[tauri::command]
pub async fn get_active_project(state: State<'_, AppState>) -> Result<Option<ProjectDto>, String>
// DB: settings.get_setting("active_project_id") → get_project(id)

#[tauri::command]
pub async fn set_active_project(state: State<'_, AppState>, project_id: i64) -> Result<(), String>
// DB: settings.set_setting("active_project_id", id)
```

### `commands/debriefs.rs`

```rust
#[tauri::command]
pub async fn get_pending_commits(
    state: State<'_, AppState>,
    project_id: i64,
) -> Result<Vec<CommitDto>, String>
// Get project path from DB
// git list_recent_commits(path, 50)
// Get all debrief commit hashes for project_id (reviewed only)
// Return commits NOT in reviewed set (they need analysis)
// Also return commits with existing pending debriefs

#[tauri::command]
pub async fn get_reviewed_commits(
    state: State<'_, AppState>,
    project_id: i64,
) -> Result<Vec<CommitDto>, String>
// DB: list_debriefs_by_status(project_id, "reviewed")
// For each debrief, return CommitDto with stats from git

#[tauri::command]
pub async fn get_debrief_by_commit(
    state: State<'_, AppState>,
    project_id: i64,
    commit_hash: String,
) -> Result<Option<DebriefDto>, String>
// DB: get_debrief_by_commit(project_id, commit_hash)
// If found: get gaps, checkpoint questions from ai_response_json

#[tauri::command]
pub async fn run_debrief(
    state: State<'_, AppState>,
    project_id: i64,
    commit_hash: String,
) -> Result<DebriefDto, String>
// Main pipeline:
// 1. Check if debrief already exists → return it
// 2. Get project from DB (path, active_skills)
// 3. Get settings (ai config, analysis depth, checkpoint mode, ignored paths)
// 4. git get_commit_diff(path, hash)
// 5. skills: load_all_skills, detect_skills_for_diff
// 6. context: build_project_structure, query history, assemble_system_message + assemble_user_message
// 7. ai: run_debrief(config, system_message, user_message)
// 8. DB: create_debrief, create_gaps (with explanation+suggestion), update_project_last_analyzed
// 9. Return DebriefDto

#[tauri::command]
pub async fn get_diff_content(
    state: State<'_, AppState>,
    project_id: i64,
    commit_hash: String,
) -> Result<Vec<FileDiffDto>, String>
// Get project path from DB
// git get_commit_diff → parse_diff_to_file_diffs
// Return full diff (NOT truncated — UI always shows full diff per spec)

#[tauri::command]
pub async fn mark_reviewed(
    state: State<'_, AppState>,
    debrief_id: i64,
) -> Result<(), String>
// DB: mark_debrief_reviewed(debrief_id)

#[tauri::command]
pub async fn get_gap_count(
    state: State<'_, AppState>,
    project_id: i64,
) -> Result<i64, String>
// DB: count_gaps_by_project(project_id)
```

### `commands/checkpoints.rs`

```rust
#[tauri::command]
pub async fn submit_checkpoint(
    state: State<'_, AppState>,
    debrief_id: i64,
    question_id: String,
    question_text: String,
    good_answer_includes: String,
    answer: String,
    mode: String,
) -> Result<EvaluationDto, String>
// DB: create_checkpoint_response(debrief_id, question_id, question_text, answer, mode)
// If mode == "free_text":
//   Get settings for AI config
//   ai: evaluate_checkpoint(config, question_text, good_answer_includes, answer)
//   DB: update_checkpoint_evaluation(id, evaluation_json)
//   Return EvaluationDto
// If mode == "multiple_choice":
//   Evaluation is done client-side; return empty/dummy Evaluation
//   (frontend already knows correct_option_index)

#[tauri::command]
pub async fn get_checkpoint_responses(
    state: State<'_, AppState>,
    debrief_id: i64,
) -> Result<Vec<CheckpointResponseDto>, String>
// DB: get_checkpoint_responses(debrief_id)
```

### `commands/knowledge.rs`

```rust
#[tauri::command]
pub async fn get_notes(state: State<'_, AppState>) -> Result<Vec<KnowledgeNoteDto>, String>
// DB: list_knowledge_notes
// For each note: read .md file content from disk (file_path)

#[tauri::command]
pub async fn get_note(
    state: State<'_, AppState>,
    note_id: i64,
) -> Result<Option<KnowledgeNoteDto>, String>
// DB: get_knowledge_note(id) → read file content

#[tauri::command]
pub async fn save_note(
    state: State<'_, AppState>,
    title: String,
    content: String,
    category_path: String,
    tags: Vec<String>,
    note_id: Option<i64>,
) -> Result<KnowledgeNoteDto, String>
// Get kb_path from settings
// knowledge::sanitize_filename, ensure_kb_dir, write_note_atomic
// DB: create_knowledge_note or update_knowledge_note

#[tauri::command]
pub async fn delete_note(
    state: State<'_, AppState>,
    note_id: i64,
) -> Result<(), String>
// DB: delete_knowledge_note
// Delete .md file from disk (best-effort, don't fail if missing)

#[tauri::command]
pub async fn search_notes(
    state: State<'_, AppState>,
    query: String,
) -> Result<Vec<KnowledgeNoteDto>, String>
// DB: search_knowledge_notes(query)

#[tauri::command]
pub async fn write_to_kb(
    state: State<'_, AppState>,
    debrief_id: i64,
    note_indices: Vec<usize>,
) -> Result<Vec<KnowledgeNoteDto>, String>
// Two-phase KB generation per spec:
// 1. Get debrief from DB (ai_response_json → parse suggested_notes)
// 2. Get settings (ai config, kb_path)
// 3. Get existing KB note titles (list_existing_note_titles)
// 4. Get commit diff snippets for context
// 5. For each selected index (serialized, not parallel per spec):
//    a. find_existing_note → read if exists
//    b. Show conflict dialog → handled on frontend (command receives conflict_resolution: "merge"|"replace"|"separate"|"skip" per note)
//    c. ai::generate_kb_note(config, KbNoteInput { ... })
//    d. knowledge::write_note_atomic with backup
//    e. DB: create_knowledge_note with source_debrief_id, source_commit, links_to
// 6. Return created/updated notes
// On LLM failure per note: mark failed, continue (max 2 retries per note)
```

**Note on conflict resolution for `write_to_kb`:** The command needs to handle the merge/replace/separate/skip choice. For MVP, the frontend will determine this before calling the command (or we can simplify: always merge if exists, unless user explicitly chose replace). This can be a follow-up refinement.

### `commands/settings.rs`

```rust
#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<AppSettingsDto, String>
// DB: get_all_settings → parse into AppSettingsDto

#[tauri::command]
pub async fn update_settings(
    state: State<'_, AppState>,
    settings: serde_json::Value,  // Partial<AppSettings> as JSON
) -> Result<AppSettingsDto, String>
// Flatten JSON to key.subkey → value pairs, call set_setting for each
// Return updated full settings

#[tauri::command]
pub async fn get_skills(state: State<'_, AppState>) -> Result<Vec<SkillDto>, String>
// skills::load_all_skills
// Merge with per-project enabled state (get active project → active_skills from DB)

#[tauri::command]
pub async fn toggle_skill(
    state: State<'_, AppState>,
    skill_id: String,
    enabled: bool,
) -> Result<(), String>
// Get active project → update active_skills JSON array in DB

#[tauri::command]
pub async fn add_skill(
    state: State<'_, AppState>,
    name: String,
    content: String,
    tags: Vec<String>,
) -> Result<SkillDto, String>
// Write .md file to ~/.diffAdvisor/skills/user/<name>.md
// Return SkillDto

#[tauri::command]
pub async fn test_connection(state: State<'_, AppState>) -> Result<ConnectionResultDto, String>
// Get AI settings from DB
// ai::test_connection(config)
// Return { success: bool, message: String }
```

---

## Step 8 — App State and `main.rs`

### `src-tauri/src/state.rs`
```rust
pub struct AppState {
    pub db: Arc<Mutex<Database>>,
}
```

### `src-tauri/src/main.rs`
```rust
fn main() {
    let db = db::open(get_db_path()).expect("Failed to open database");
    let state = AppState::new(db);

    tauri::Builder::default()
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::projects::add_project,
            commands::projects::list_projects,
            commands::projects::remove_project,
            commands::projects::get_active_project,
            commands::projects::set_active_project,
            commands::debriefs::get_pending_commits,
            commands::debriefs::get_reviewed_commits,
            commands::debriefs::get_debrief_by_commit,
            commands::debriefs::run_debrief,
            commands::debriefs::get_diff_content,
            commands::debriefs::mark_reviewed,
            commands::debriefs::get_gap_count,
            commands::checkpoints::submit_checkpoint,
            commands::checkpoints::get_checkpoint_responses,
            commands::knowledge::get_notes,
            commands::knowledge::get_note,
            commands::knowledge::save_note,
            commands::knowledge::delete_note,
            commands::knowledge::search_notes,
            commands::knowledge::write_to_kb,
            commands::settings::get_settings,
            commands::settings::update_settings,
            commands::settings::get_skills,
            commands::settings::toggle_skill,
            commands::settings::add_skill,
            commands::settings::test_connection,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn get_db_path() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("diffAdvisor")
        .join("diffadvisor.db")
}
```

On `set_active_project`: start the file watcher for that project's `.git/refs/heads/`. The watcher handle is stored in state (extend AppState with `watcher: Mutex<Option<RecommendedWatcher>>`).

---

## Step 9 — Frontend `src/services/tauri.ts`

Replace all `notImplemented()` with real `invoke()` calls:

```typescript
import { invoke } from '@tauri-apps/api/core'

class TauriProjectService implements IProjectService {
  getProjects() { return invoke<Project[]>('list_projects') }
  getActiveProject() { return invoke<Project | null>('get_active_project') }
  setActiveProject(id: string) { return invoke('set_active_project', { projectId: parseInt(id) }) }
  addProject(path: string) { return invoke<Project>('add_project', { path }) }
  removeProject(id: string) { return invoke('remove_project', { projectId: parseInt(id) }) }
}

class TauriDebriefService implements IDebriefService {
  getPendingCommits(projectId: string) {
    return invoke<Commit[]>('get_pending_commits', { projectId: parseInt(projectId) })
  }
  getReviewedCommits(projectId: string) {
    return invoke<Commit[]>('get_reviewed_commits', { projectId: parseInt(projectId) })
  }
  getDebriefByCommit(commitHash: string) {
    // Get active project id first, then call command
    return invoke<DebriefResult | null>('get_debrief_by_commit', { commitHash })
  }
  runDebrief(commitHash: string) {
    return invoke<DebriefResult>('run_debrief', { commitHash })
  }
  markReviewed(debriefId: string) {
    return invoke('mark_reviewed', { debriefId: parseInt(debriefId) })
  }
  getDiffContent(commitHash: string) {
    return invoke<FileDiff[]>('get_diff_content', { commitHash })
  }
  getGapCount(projectId: string) {
    return invoke<number>('get_gap_count', { projectId: parseInt(projectId) })
  }
}
// ... similar for Checkpoint, Knowledge (including writeToKb), Settings
```

**Active project context for commands that need it:** Commands like `run_debrief(commitHash)` will look up the active project from settings internally in the Rust command — no extra roundtrip needed.

### `src/services/types.ts` update

Add to `IKnowledgeService`:
```typescript
writeToKb(debriefId: string, noteIndices: number[]): Promise<KnowledgeNote[]>
```

Also add `writeToKb` to the MockKnowledgeService (mock.ts) as a no-op or returning mock notes.

---

## Step 10 — Built-in Skill Files

Create `src-tauri/skills/` with 7 files per spec section 5.5. Each file follows the format:

```markdown
---
name: Security General
detect:
  files: []
  content_patterns: []
  extensions: []
tags: [security, owasp]
description: Always-active security checklist
---
[content]
```

Files to create: `security-general.md`, `nodejs-express.md`, `react.md`, `nextjs.md`, `django.md`, `sql-databases.md`, `rest-api.md`.

---

## Step 11 — Module Declarations

### `src-tauri/src/lib.rs`
```rust
pub mod db;
pub mod state;
pub mod services;
pub mod commands;
```

### `src-tauri/src/services/mod.rs`
```rust
pub mod git;
pub mod ai;
pub mod context;
pub mod skills;
pub mod knowledge;
pub mod watcher;
```

### `src-tauri/src/commands/mod.rs`
```rust
pub mod projects;
pub mod debriefs;
pub mod checkpoints;
pub mod knowledge;
pub mod settings;
```

---

## Implementation Order (dependency-safe)

1. **Cargo.toml** — add dependencies
2. **DB migration_002** + model/CRUD updates — foundation for new columns
3. **state.rs** — AppState
4. **services/git.rs** — no external deps, testable in isolation
5. **services/skills.rs** — depends on file system + serde_yaml
6. **services/context.rs** — depends on git.rs + skills.rs
7. **services/ai.rs** — depends on reqwest + context types
8. **services/knowledge.rs** — depends on ai.rs types
9. **services/watcher.rs** — depends on notify + tauri app handle
10. **commands/** (all 5 files) — depends on all services + db
11. **main.rs** — wire everything together
12. **Built-in skill .md files** — needed by skills.rs
13. **Frontend tauri.ts** — depends on all commands being registered
14. **services/types.ts** — add writeToKb

---

## Verification

1. `cargo build` in `src-tauri/` should compile clean
2. `cargo test` — existing 53 tests + new migration_002 test should pass
3. `npm run tauri dev` — app starts without errors
4. Manual test flow:
   - Settings → add AI endpoint + key → Test Connection → success
   - Settings → Monitored Directory → browse to a git repo
   - Dashboard → project path shows, pending commits appear
   - Click a commit → Debrief page loads, diff shows in Monaco
   - Run Debrief → AI response appears in right panel
   - Answer checkpoint question → evaluation score appears
   - Save to KB → note appears in Knowledge Base
   - Mark Reviewed → commit moves to reviewed list
