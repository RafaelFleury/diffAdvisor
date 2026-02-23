# Phase 2: Post-Review Changes

Changes made to the Phase 2 database layer after external review, compared to the original plan.

## 1. KnowledgeNote.tags — String → Vec<String> (High)

**Original:** `tags` field was a plain `String` (comma-separated).
**Changed:** `tags` is now `Vec<String>`, stored as JSON array in the DB — same pattern as `Project.frameworks` and `Debrief.skills_used`.

**Why:** Frontend `KnowledgeNote` type expects `tags: string[]`. Storing as JSON array avoids ad-hoc parsing in Phase 3.

**Files:** `models.rs`, `knowledge.rs`, integration test.

## 2. Settings keys aligned to frontend contract (High)

**Original seed keys → New keys:**

| Original | New (matches frontend) |
|---|---|
| `project.monitoredPath` | `project.monitoredDirectory` |
| `project.extensions` | `project.fileExtensions` |
| `analysis.depth` | `analysis.analysisDepth` |
| `knowledge.autoGenerate` | `knowledge.autoGenerateNotes` |
| `appearance.language` | `appearance.debriefLanguage` |

**Also:**
- Added `project.hasGitignore` (missing from original seed, present in frontend `ProjectSettings`).
- Default language changed from `"en"` to `"english"` (matching the `DebriefLanguage` union type).
- `get_app_settings()` now parses `"true"`/`"false"` into JSON booleans instead of keeping them as strings.

**Why:** DB keys must match frontend `AppSettings` field names exactly so Phase 3 IPC can pass them through without a mapping layer.

**Files:** `schema.rs`, `settings.rs`.

## 3. get_debrief_by_commit scoped by project_id (Medium)

**Original:** `get_debrief_by_commit(commit_hash)` — global lookup, no project scoping.
**Changed:** `get_debrief_by_commit(project_id, commit_hash)` — query filters by both fields.

**Why:** In multi-project use, the same short commit hash could exist in different repos. Without project scoping, the query would return an arbitrary match.

**Files:** `debriefs.rs`, integration test callers updated.

## 4. Added 12 new tests (Low)

**Original plan:** ~40 tests. **Now:** 53 tests (52 unit + 1 integration).

New tests cover previously untested branches:

- **projects.rs:** `update_project`, `update_project_not_found`, `update_project_skills_not_found`, `update_project_last_analyzed_not_found`, `delete_project_not_found`
- **debriefs.rs:** `mark_reviewed_not_found`, `get_debrief_not_found`, `get_debrief_by_commit_scoped_to_project`
- **checkpoints.rs:** `update_evaluation_not_found`
- **knowledge.rs:** `update_knowledge_note_not_found`, `delete_knowledge_note_not_found`, `get_knowledge_note_not_found`
