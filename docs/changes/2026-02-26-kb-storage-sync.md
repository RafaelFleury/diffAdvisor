# KB Storage Sync Changes

Date: 2026-02-26

## Context

The original plan aimed to make the configured Knowledge Base storage path behave as the source of truth while keeping the existing SQLite table as a lightweight index. During implementation, the shipped solution stayed within that goal but differed in a few important details to reduce risk and avoid new breakage.

## What Was Implemented

- KB reads now sync against real `.md` files under the active `knowledge.storagePath` before returning notes.
- The backend scans the active root, reads note frontmatter when available, and upserts note metadata in the SQLite index by exact `file_path`.
- KB list, search, and single-note loading now filter out rows whose files are missing or whose paths are outside the currently configured KB root.
- `write_to_kb` now syncs first and reuses existing indexed notes by exact `file_path` instead of scanning all DB rows and matching manually.
- The Knowledge Base settings UI now refreshes the KB list when the storage path is committed through input blur or the Browse action.
- The knowledge store now reselects a valid note after refresh so the UI does not keep a stale selection from a previous KB root.

## Intentional Differences From The Plan

### 1. No dedicated sync command was added

The plan suggested a dedicated backend sync command that could be triggered explicitly from the settings UI. Instead, sync was embedded directly into the existing KB command flow:

- `get_notes`
- `get_note`
- `search_notes`
- `write_to_kb`

Reason:

- This kept the change surface smaller.
- It avoided adding a new Tauri command and frontend service contract.
- It guaranteed sync happens before the KB data is actually used, not only after settings changes.

### 2. Settings persistence behavior was not changed

The settings screen still persists `knowledge.storagePath` while typing. The implementation did not move that persistence logic to a delayed or explicit-save model.

Instead, the expensive KB refresh was limited to committed actions:

- input `blur`
- `Browse` selection

Reason:

- This preserved existing settings behavior.
- It avoided a broader settings refactor in a sensitive area.

### 3. Existing stale DB rows are hidden, not deleted

The plan already preferred a non-destructive first pass. The implemented version keeps that rule:

- old-path rows can remain in SQLite
- rows outside the active KB root are no longer visible in the app
- missing-file rows are also filtered out

Reason:

- This avoids irreversible cleanup while the new behavior stabilizes.

## Files Changed

- `src-tauri/src/services/knowledge.rs`
- `src-tauri/src/db/knowledge.rs`
- `src-tauri/src/commands/knowledge.rs`
- `src/components/features/settings/KnowledgeBaseSettings.tsx`
- `src/stores/knowledgeStore.ts`

## Validation Performed

- `cargo test --lib knowledge -- --nocapture`
- `pnpm exec tsc --noEmit`
- IDE lints on the edited files

## Result

The active KB filesystem path now determines which notes are visible in the application, while SQLite remains a supporting index rather than the primary source of truth for KB visibility.
