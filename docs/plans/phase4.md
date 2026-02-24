# Phase 4 Plan — diffAdvisor: Connect Frontend to Backend

## Context

Phases 1–3 are complete: the React frontend works against mock data, the SQLite database layer has 53 tests passing, and all Rust services (git, AI, context, skills, knowledge, watcher) plus all Tauri IPC commands are implemented. `src/services/tauri.ts` has real `invoke()` calls for every method.

Phase 4 connects everything by: switching the service factory from Mock to Tauri, fixing type contract mismatches that would cause silent runtime bugs, wiring up the commit-detected watcher event, and correcting the Dashboard's hardcoded mock project ID.

---

## Changes Required

### 1. `src/services/index.ts` — Switch USE_MOCK

**Problem:** `USE_MOCK = import.meta.env.DEV` is `true` during `npm run tauri dev`, so the app always uses mocks in development — the real backend is never exercised.

**Fix:** Detect Tauri availability instead of DEV flag:
```typescript
const USE_MOCK = !('__TAURI_INTERNALS__' in window)
```
This uses mocks in a plain browser (for UI-only work) and real Tauri services whenever the app runs inside Tauri — including dev mode.

---

### 2. `src-tauri/src/commands/projects.rs` — Add `ProjectDto` with `id: String`

**Problem:** All 5 project commands return the raw `Project` model (`id: i64`). The TypeScript type expects `id: string`. The `tauri.ts` calls `parseInt(project.id)` which depends on `id` being a string.

**Fix:** Create a `ProjectDto` struct and a `project_to_dto` helper; update all commands to return it:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDto {
    pub id: String,       // i64 → String
    pub name: String,
    pub path: String,
    pub language: String,
    pub frameworks: Vec<String>,
    pub active_skills: Vec<String>,
    pub created_at: String,
    pub last_analyzed_at: Option<String>,
}

fn project_to_dto(p: &Project) -> ProjectDto {
    ProjectDto { id: p.id.to_string(), name: p.name.clone(), ... }
}
```
Update `add_project`, `list_projects`, `get_active_project` return types from `Project` / `Vec<Project>` / `Option<Project>` to their `Dto` equivalents.

---

### 3. `src-tauri/src/commands/debriefs.rs` — Fix `DebriefDto.id` + add `CommitDto`

**Problem A:** `DebriefDto.id` is `i64` but `DebriefResult.id` in TypeScript is `string`. The store compares `currentDebrief.id === debriefId` (both should be strings).

**Fix:** Change `pub id: i64` → `pub id: String` in `DebriefDto` and update `debrief_to_dto` to use `debrief.id.to_string()`.

**Problem B:** `get_pending_commits` and `get_reviewed_commits` return `Vec<git::CommitInfo>` which has no `status` field. The TypeScript `Commit` type requires `status: CommitStatus`.

**Fix:** Create `CommitDto` wrapping `CommitInfo` + `status`:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitDto {
    pub hash: String,
    pub message: String,
    pub author: String,
    pub timestamp: String,
    pub files_changed: i32,
    pub additions: i32,
    pub deletions: i32,
    pub status: String,   // "pending" | "reviewed"
}
```
Update both commands to return `Vec<CommitDto>`, converting from `CommitInfo` and injecting `status`.

---

### 4. `src/pages/Dashboard.tsx` — Fix hardcoded project ID + watcher listener

**Problem A:** Dashboard calls `loadCommits('proj-1')` and `loadGapCount('proj-1')` with a hardcoded mock ID. The real backend will return actual numeric IDs.

**Fix:** Load the active project first, then use its `id`:
```tsx
useEffect(() => {
  loadActiveProject().then(() => {
    const { activeProject } = useProjectStore.getState()
    if (activeProject) {
      loadCommits(activeProject.id)
      loadGapCount(activeProject.id)
    }
  })
}, [])
```

**Problem B:** The Rust watcher emits `commit_detected` Tauri events when a new commit is pushed, but nothing on the frontend listens. Commits won't appear without a manual refresh.

**Fix:** Add a Tauri event listener in Dashboard. Only wire it up when running in Tauri (guard with `'__TAURI_INTERNALS__' in window` to avoid breaking browser dev mode):
```tsx
useEffect(() => {
  if (!('__TAURI_INTERNALS__' in window)) return
  import('@tauri-apps/api/event').then(({ listen }) => {
    listen('commit_detected', () => {
      const { activeProject } = useProjectStore.getState()
      if (activeProject) loadCommits(activeProject.id)
    }).then(unlisten => () => unlisten())
  })
}, [])
```

---

### 5. `src-tauri/src/main.rs` — Resume watcher on app startup

**Problem:** The watcher is only started when `set_active_project` is called. On app restart, no watcher starts. New commits made while the app was closed won't trigger events after reopen.

**Fix:** Add `.setup()` to `tauri::Builder` to resume the watcher on startup:
```rust
.setup(|app| {
    let state = app.state::<AppState>();
    let db = state.db();
    if let Ok(Some(id_str)) = db.get_setting("active_project_id") {
        if let Ok(id) = id_str.parse::<i64>() {
            if let Ok(project) = db.get_project(id) {
                let handle = app.handle().clone();
                if let Ok(w) = watcher::start_watcher(project.path, handle) {
                    state.set_watcher(Some(w));
                }
            }
        }
    }
    Ok(())
})
```

---

### 6. `src/types/checkpoint.ts` — Add optional multiple-choice fields

**Problem:** `CheckpointQuestionDto` on the Rust side has `options: Option<Vec<String>>` and `correct_option_index: Option<u32>` for multiple-choice mode. The TypeScript `CheckpointQuestion` type doesn't declare these fields.

**Fix:**
```typescript
export interface CheckpointQuestion {
  id: string
  question: string
  concept: string
  goodAnswerIncludes: string
  options?: string[]              // multiple_choice mode
  correctOptionIndex?: number     // multiple_choice mode
}
```

---

## Files Modified

| File | Change |
|------|--------|
| `src/services/index.ts` | Switch `USE_MOCK` to Tauri detection |
| `src/pages/Dashboard.tsx` | Fix hardcoded ID, add watcher event listener |
| `src/types/checkpoint.ts` | Add optional MC fields |
| `src-tauri/src/commands/projects.rs` | Add `ProjectDto`, update all 5 commands |
| `src-tauri/src/commands/debriefs.rs` | Fix `DebriefDto.id: String`, add `CommitDto` |
| `src-tauri/src/main.rs` | Add `.setup()` for watcher startup |

---

## Verification

1. `cargo build` in `src-tauri/` — clean compile
2. `cargo test` — all 53+ tests pass
3. `npm run tauri dev` — app launches in Tauri context, **not** using mock data
4. Manual end-to-end flow:
   - Settings → AI endpoint + key → Test Connection → success
   - Settings → Monitored Directory → set to a real git repo
   - Dashboard → real project path shown, real git commits appear
   - Click a commit → Debrief page loads with real diff in Monaco
   - Click Run Debrief → real AI response populates right panel
   - Answer a checkpoint → evaluation score appears
   - Save to KB → note appears in Knowledge Base page
   - Mark Reviewed → commit moves to Reviewed list
   - Make a new commit in the watched repo → it appears in Dashboard automatically (no refresh)
