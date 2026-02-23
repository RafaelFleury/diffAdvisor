# LLM Context Management

**Status:** Design specification — applies to Phase 3 (`ai.rs` implementation)

This document addresses gaps in `initialPrompt.md` regarding how the backend assembles the LLM context. The original spec defines what goes into the request but does not specify token limits, truncation, history depth, overflow behavior, knowledge base file operations, or retry strategies. This document fills those gaps with concrete rules.

---

## 0. Scope Assumption (MVP)

For MVP, the product assumes the user intentionally analyzes code that is acceptable to send to their configured LLM endpoint.

- No mandatory "safe mode" is enforced in context assembly.
- No mandatory local-only model restriction is enforced.
- No mandatory redaction gate is required for Phase 3.

Optional privacy/safety controls can be added later, but they are out of scope for this document.

---

## 1. Context Budget

All requests target a **shared context budget** based on the configured model. The budget must accommodate both input and output within the model's context window.

### 1.0 Model Capability Baseline (Required)

For MVP, every configured model is expected to have a context window of **128k tokens or higher**.

- Minimum supported model context window: **128 000**
- Hard input cap: **100 000** tokens (all request profiles)
- No hard output cap by default (see rule 1.1 for fallback)
- Reserved headroom: **~28 000** tokens (output + tooling/system/provider variance)

If the configured provider/model reports a context window below 128k, the app must fail fast with a visible error and skip analysis.

> **Implementation note — token estimation:**
> Use a fast, approximate character-based token counter. Exact counts are not required — the goal is to stay well under the limit, not to fill it perfectly.
>
> - **Code content** (diffs, project structure): estimate at **3.5 characters per token**. Code is more token-dense due to short identifiers, symbols, and whitespace.
> - **Natural language** (system prompt, skill prose, history summaries): estimate at **4 characters per token**.
> - After each debrief request, if the provider returns a `usage` object with actual token counts, log the estimated-vs-actual ratio. This enables future calibration without blocking MVP.

### 1.1 Output Token Cap Strategy

By default, do **not** set an output token cap on requests. This allows the model to use as much output as it needs based on the analysis depth prompt instructions (rule 3.6).

**Fallback behavior:**

1. Send the first request **without** `max_completion_tokens` or `max_tokens`.
2. If the request fails because the provider requires an explicit output cap, **retry once** with `max_completion_tokens` set to **16 000** tokens. If `max_completion_tokens` is not supported, fall back to `max_tokens: 16000`.
3. After a successful fallback, persist the provider's requirement in settings so subsequent requests use the cap directly (no wasted retry).
4. Persist request metadata for debugging:
   - Provider endpoint
   - Model name
   - Whether an output cap was used and which field (`none`, `max_completion_tokens`, `max_tokens`)
   - Effective output cap value (if any)

---

## 2. What "History" Means

The `initialPrompt.md` spec mentions `"history"` as part of the user message but does not define it. For the MVP, history is:

- **Last N reviewed debriefs for the same project** (depth varies by analysis setting — see rule 3.3)
- Included as a compact summary, not the full `ai_response_json`
- Format (one line per past debrief):

```
## Prior Context (last N reviews)
[a3f7c2d] Add user login endpoint — gaps: rate limiting missing, no input validation
[b1d4e8f] Scaffold database models — gaps: N+1 risk on list query
[c9a0123] Initial commit — gaps: no error handling on external calls
```

Each line is a single sentence: commit hash, message, and a brief summary of the most critical gaps. This costs roughly 50–100 tokens per entry.

**When to omit history entirely:**

- The project has zero reviewed debriefs (first analysis)
- The user has disabled history in settings (future toggle)
- The analysis depth is Quick (rule 3.3)
- The assembled context is already near the budget limit before history is added

---

## 3. Rules

### 3.1 Diff Truncation

The diff is the most variable-size input. Regardless of analysis depth, the diff competes for the same 100k input budget. The following rules apply in order:

1. **If the diff fits within the remaining input budget after system prompt + skills + structure + history:** include in full.
2. **If the diff exceeds the remaining budget:**
   - Apply **risk-aware file prioritization** before trimming by size.
   - Priority tiers:
     1. Security/auth/permission boundaries (e.g., auth middleware, access checks, policy files)
     2. Runtime and deployment configuration (e.g., env loading, CI/CD, infra manifests)
     3. API boundary and data contract files (controllers/routes/schemas/DTOs)
     4. Database schema/migration/query-layer files
     5. Remaining files by descending changed-line count
   - Keep the first and last 100 lines of each file's diff intact.
   - Collapse the middle with a clear marker:
     ```diff
     @@ ... @@
     [--- 248 lines omitted for context limit ---]
     ```
   - If after collapsing the diff still exceeds the budget: include only the highest-priority files that fit the remaining budget and note how many files were omitted.
3. **If the diff contains binary files or generated files** (e.g., `package-lock.json`, `yarn.lock`, `Cargo.lock`, `.min.js`, `.min.css`, image diffs): exclude them entirely and note the exclusion. These add tokens without educational value.

The `diff_content` stored in the database is always the **full** diff. Only the version sent to the LLM is truncated. The diff viewer in the UI always shows the full diff.

**Minified file detection heuristic:** if any single line in a file's diff exceeds 500 characters, treat the entire file as minified and exclude it.

### 3.2 Skill Loading and Inclusion Rules

Skills have two loading sources for debrief analysis:

1. **Manual skills (user-selected in Settings):**
   - Always loaded.
   - Always injected in full.
   - Never partially truncated.
   - Never dropped by overflow logic.
2. **Auto skills (keyword-matched from current diff):**
   - Loaded only if detection criteria match the current diff context (see rule 3.2.1).
   - Injected in full (no partial truncation).
   - Can be dropped entirely if context overflow requires it (lowest relevance first).

This means skill truncation is not allowed. A skill is either included in full or excluded entirely. Manual skills always win.

#### 3.2.1 Auto Skill Detection Algorithm

Each skill's frontmatter contains a `detect` block with three optional fields: `files`, `content_patterns`, and `extensions`. Auto-detection matches these against the **current diff context** (not the full project):

| Detect field | Matched against | Match logic |
|---|---|---|
| `detect.files` | File paths in the diff (full relative paths) | Any listed filename appears as a changed file path or substring of a changed file path |
| `detect.content_patterns` | Added lines in the diff + commit message | Any listed pattern appears (case-insensitive substring match) in added lines or the commit message |
| `detect.extensions` | File extensions of changed files | Any listed extension matches a changed file's extension |

A skill is auto-activated if **any one** of its detect criteria matches. Multiple matches increase relevance (used for drop ordering in overflow — see rule 3.5).

**Relevance scoring for overflow ordering:**
- 1 point per `detect.files` match
- 1 point per `detect.content_patterns` match (capped at 3)
- 1 point per `detect.extensions` match (capped at 3)
- Higher score = higher priority = dropped last

### 3.3 History Depth

- History depth follows analysis depth:
  - Quick: **no history**
  - Balanced: last **3** reviewed debriefs
  - Deep: last **5** reviewed debriefs
- Select the most recent **reviewed** debriefs (status = `reviewed`) for the same `project_id`.
- Do not include pending debriefs — they have not been validated.
- If the project has fewer reviewed debriefs than requested, include however many exist (including zero).

### 3.4 Project Structure

The project structure snapshot (file tree) is:

- Built at analysis time by listing the project directory
- Respects the user's ignored paths config (same list as the file watcher)
- Limited to **3 levels of depth** from the project root
- Capped at **100 entries** total; if exceeded, trim the deepest / most numerous directories first
- Format: plain indented tree (not JSON)

```
my-project/
├── src/
│   ├── controllers/
│   ├── models/
│   └── routes/
├── tests/
├── package.json
└── README.md
```

### 3.5 Context Overflow Handling

**Pre-flight check (at settings save time):** Before assembly, verify that `base_prompt_tokens + sum(manual_skill_tokens) < 70% of input cap (70 000 tokens)`. If manual skills exceed this threshold, show a warning in the Settings UI: *"Selected manual skills use a large portion of the context budget. This may limit diff and history inclusion."* This is a warning, not a blocker.

**At assembly time**, if the assembled context exceeds the 100k input cap:

1. Drop history entirely.
2. If still over: reduce diff to 2 000 tokens from the highest-priority files only (rule 3.1 tiers).
3. If still over: drop the project structure snapshot.
4. If still over: drop **auto** keyword-matched skills entirely (lowest relevance score first, per rule 3.2.1). Manual skills remain loaded.
5. If still over: surface a visible error to the user: *"Analysis exceeds context limits with current manual skills. Reduce selected manual skills or split the commit."*

At each step, log which slot was dropped and at what token count the decision was made. This log is stored in `debrief.ai_response_json` under an optional `"context_reduction_log"` key so it is available for debugging.

### 3.6 Analysis Depth Setting

The Analysis Depth setting (Quick / Balanced / Deep) controls how the LLM approaches the analysis. Depth is enforced **through prompt instructions**, not through input/output token caps. All depths share the same 100k input budget and uncapped output.

| Depth | Prompt behavior | History | Skills |
|-------|----------------|---------|--------|
| Quick | Prompt instructs: concise analysis, 1-2 sentence architectural summary, top 3 gaps only, 2 checkpoint questions, no suggested notes | None | Manual skills + auto skills with relevance score ≥ 2 |
| Balanced | Prompt instructs: standard analysis, full architectural summary, up to 5 gaps, 3 checkpoint questions, up to 3 suggested notes | Last 3 | Manual skills + all auto skills |
| Deep | Prompt instructs: thorough analysis, detailed architectural summary with pattern discussion, up to 5 gaps with extended explanations, 3 checkpoint questions with deeper concept coverage, up to 5 suggested notes | Last 5 | Manual skills + all auto skills |

The depth instruction is appended to the system prompt as an `## Analysis Depth` section:

```
## Analysis Depth: [Quick|Balanced|Deep]

[Depth-specific instructions as described above]
```

This gives users a direct way to trade cost and speed for depth of analysis, while letting the model use its full context window and output capacity regardless of depth.

### 3.7 Knowledge Base `.md` Generation Uses a Different Profile

Knowledge base note generation must not reuse the debrief profile as-is.

- `.md` note generation runs as a separate request profile from debrief analysis.
- Default note-generation profile:
  - Input cap: **50 000** tokens
  - Output: uncapped (fallback to **16 000** tokens, same strategy as rule 1.1)
- Note-generation input must include debrief context so the note content is grounded:
  - Architectural summary
  - Decisions made
  - Gaps found
  - Selected checkpoint concepts
  - Selected high-signal diff snippets
  - Existing note content (if updating — see Section 6)
  - KB filesystem context: titles and categories of existing notes for wikilink targeting
- Exclude full project tree and full cross-commit history by default for note generation.

---

## 4. Context Assembly Order

### 4.0 Assembly Dependency Chain

The assembly order has a critical dependency: auto-skill detection requires diff content, but the system prompt size (which includes skills) determines how much budget remains for the user message. The correct order is:

1. **Parse diff** from git — get the full diff and list of changed files.
2. **Detect auto skills** by matching skill `detect` fields against the parsed diff (file paths, extensions, added lines, commit message).
3. **Assemble system message** (base prompt + depth instruction + manual skills + matched auto skills) → measure token count.
4. **Measure remaining budget** = 100 000 − system message tokens.
5. **Assemble user message** within the remaining budget, following the order in 4.1.

### 4.1 User Message Assembly

The user message is assembled in this fixed order:

```
## Project Structure
[trimmed file tree]

## Commit Information
Hash: [commit_hash]
Message: [commit_message]
Author: [author]
Date: [commit_date]
Files changed: [n]

## Prior Context (last N reviews)
[history lines — omit section entirely if no history]

## Diff
[truncated or full diff content]

## Omitted Files Summary
[brief list of excluded or not-included files and reason — omit if nothing was excluded]
```

### 4.2 System Message Assembly

```
[base system prompt]

## Analysis Depth: [Quick|Balanced|Deep]
[depth-specific instructions]

## Active Skills

### Skill: [Name]
[skill content]

### Skill: [Name]
[skill content]
```

---

## 5. What Is Not Sent to the LLM

To avoid unnecessary token usage, the following are explicitly excluded:

| Item | Why excluded |
|------|-------------|
| Full `ai_response_json` of prior debriefs | Too large; summary in history is sufficient |
| Binary file diffs | No educational value, high token cost |
| Lock files (`package-lock.json`, `yarn.lock`, `Cargo.lock`) | Generated content, not authored code |
| Minified files (`.min.js`, `.min.css`) | Unreadable; not authored code (detected via 500-char line heuristic) |
| Build artifacts (`dist/`, `build/`, `__pycache__/`) | Not source code |
| Files matching ignored paths config | User explicitly excluded them |

---

## 6. LLM Response Format

### 6.1 Debrief Response Schema

The LLM returns a single JSON object. All responses include a `schema_version` field for forward compatibility — old debriefs stored in the DB can be parsed correctly even if the schema evolves.

```json
{
  "schema_version": 1,
  "architectural_summary": "2-3 sentences explaining WHAT this code does in the system at an architectural level",
  "patterns_identified": ["list of design patterns or architectural decisions"],
  "decisions_made": [
    {
      "decision": "what was chosen",
      "alternatives": "what could have been chosen instead",
      "tradeoffs": "why it matters"
    }
  ],
  "gaps": [
    {
      "severity": "critical | warning | info",
      "category": "security | performance | reliability | maintainability",
      "description": "what's missing or wrong",
      "explanation": "why this matters in production",
      "suggestion": "what should be done"
    }
  ],
  "checkpoint_questions": [
    {
      "question": "a behavioral/architectural question",
      "concept": "the underlying concept being tested",
      "good_answer_includes": "key points a good answer would cover",
      "options": ["option A", "option B", "option C", "option D"],
      "correct_option_index": 0
    }
  ],
  "suggested_notes": [
    {
      "title": "concept name (used as filename and link target)",
      "category": "suggested category path",
      "tags": ["list", "of", "tags"],
      "links_to": ["other concept titles to [[link]] to"],
      "summary": "1-2 sentence summary of what the full note should cover"
    }
  ]
}
```

**Key differences from `initialPrompt.md` schema:**

1. **`schema_version`** added for forward compatibility.
2. **`knowledge_base_notes` renamed to `suggested_notes`** — the debrief produces note *suggestions* (title, category, tags, summary), not full Obsidian markdown. Full note content is generated by a separate KB-specific LLM call when the user clicks "Write to KB" (Section 8).
3. **`suggested_notes[].content` replaced with `summary`** — a brief description of what the note should cover, not the full body. This saves output tokens in the debrief response.
4. **`checkpoint_questions` includes optional MC fields** — `options` and `correct_option_index` are present when the checkpoint mode is `multiple_choice`. When mode is `free_text`, these fields are omitted and the LLM generates only `question`, `concept`, and `good_answer_includes`.

**Suggested note count limits by depth:**
- Quick: up to 0 (no suggestions)
- Balanced: up to 3
- Deep: up to 5

### 6.2 Checkpoint Mode in System Prompt

The system prompt includes a conditional section based on the `analysis.checkpointMode` setting:

**For `free_text` mode:**
```
## Checkpoint Format
Generate checkpoint questions with: question, concept, good_answer_includes.
Do NOT include "options" or "correct_option_index" fields.
```

**For `multiple_choice` mode:**
```
## Checkpoint Format
Generate checkpoint questions with: question, concept, good_answer_includes, options (array of 4 choices), correct_option_index (0-based index of the correct option).
Options should include one correct answer and three plausible distractors that test common misconceptions.
```

### 6.3 Question ID Assignment

The LLM does not generate question IDs. The backend assigns IDs during debrief creation:
- Format: `"q1"`, `"q2"`, `"q3"` based on array index in `checkpoint_questions`.
- These IDs are stored in `checkpoint_responses.question_id` and used by the frontend to match responses to questions.

### 6.4 JSON Parsing and Retry

The backend assumes the LLM response is valid JSON and parses it directly. If parsing fails:

1. **Extraction attempt:** Strip markdown code fences (` ```json ... ``` `), find the outermost `{...}` block, and parse.
2. **If extraction succeeds:** proceed normally but log a warning.
3. **If extraction fails:** retry once with an appended instruction:
   - Append to the user message: `"IMPORTANT: Your previous response was not valid JSON. Respond ONLY with a JSON object, no markdown formatting, no explanation text."`
   - If the retry also fails: surface a clear error to the user: *"The AI model returned an invalid response. Try again or check your model configuration."*

---

## 7. Gap and Checkpoint Data Flow

### 7.1 Gap Storage

When a debrief is created, the full LLM response is stored in `debrief.ai_response_json`. Additionally, each gap is extracted and inserted into the `gaps` table for independent querying (unresolved gaps across project, severity counts, etc.).

**Required schema change:** The `gaps` table must include `explanation` and `suggestion` columns (both `TEXT`) alongside the existing `severity`, `category`, and `description`. This avoids requiring a join-and-parse of `ai_response_json` every time the frontend displays gap details.

```sql
ALTER TABLE gaps ADD COLUMN explanation TEXT NOT NULL DEFAULT '';
ALTER TABLE gaps ADD COLUMN suggestion TEXT NOT NULL DEFAULT '';
```

### 7.2 Checkpoint Storage

When a debrief is created, checkpoint questions are stored as part of `ai_response_json`. When a user submits a response, it is stored in `checkpoint_responses` with:
- `question_id`: assigned by backend (`"q1"`, `"q2"`, `"q3"`)
- `question_text`: copied from the LLM response for independent readability
- `mode`: `"free_text"` or `"multiple_choice"`
- `ai_evaluation_json`: populated after the user submits (for free_text mode, requires a second LLM call; for MC mode, can be evaluated client-side)

---

## 8. Knowledge Base File Operations

This is the most complex subsystem in Phase 3. KB operations involve LLM generation, filesystem writes, DB index updates, and conflict handling.

### 8.1 Two-Phase Note Generation

KB note generation is a **two-phase** process:

**Phase A — Debrief (automatic):** The debrief LLM call produces `suggested_notes` — lightweight suggestions (title, category, tags, summary). These are displayed in the Debrief UI as "concepts identified" that the user can select for KB export.

**Phase B — Write to KB (user-triggered):** When the user clicks "Write to KB" and selects which suggested notes to generate, a **separate LLM call** runs for each selected note using the KB generation profile (rule 3.7). This call produces the full Obsidian-formatted markdown body.

### 8.2 KB Generation LLM Input

For each note being generated, the KB LLM call receives:

**System message:**
```
You are generating an Obsidian-compatible knowledge base note for a junior developer.

## Rules
- Output valid JSON with the structure specified below
- Use [[double bracket links]] (Wikilinks) to reference related concepts
- Link aggressively: if a concept is mentioned, link it with [[]]
- Write for the developer's project context, not generic tutorials
- Include concrete code examples from the provided diff when useful
- Keep notes concise and scannable
- Use standard markdown headings (##, ###) for Obsidian outline view
- Include language identifiers on code blocks for syntax highlighting
- Do NOT include YAML frontmatter — the app adds it automatically
```

**User message:**
```
## Note Target
Title: [title from suggested_notes]
Category: [category]
Tags: [tags]
Summary: [summary from suggested_notes]
Related concepts to [[link]]: [links_to]

## Debrief Context
Architectural summary: [from debrief]
Decisions: [from debrief]
Gaps: [from debrief]

## Relevant Diff Snippets
[high-signal portions of the diff related to this concept]

## Existing Note Content (if updating)
[full content of the existing .md file, or "This is a new note." if creating]

## Existing KB Notes (for linking)
[list of existing note titles and categories so the LLM can create accurate [[wikilinks]]]
```

**Response format:**
```json
{
  "title": "Note Title",
  "content": "Full Obsidian markdown body (no frontmatter)"
}
```

### 8.3 File Write Strategy

#### 8.3.1 New Note Creation

1. **Sanitize filename** from the LLM-provided title:
   - Strip characters illegal in filenames: `/ \ : * ? " < > |`
   - Replace stripped characters with a space, then collapse multiple spaces
   - Cap filename at 200 characters (filesystem limit safety)
   - Preserve readable titles — use spaces, not slugs (Obsidian convention)
2. **Ensure directory exists:** `mkdir -p <kb_path>/<category>/`
3. **Build frontmatter:**
   ```yaml
   ---
   title: [sanitized title]
   tags: [tags array]
   category: [category path]
   source_project: [project name]
   source_commit: [commit hash]
   auto_generated: true
   created: [YYYY-MM-DD]
   ---
   ```
4. **Combine:** frontmatter + newline + LLM-generated content body
5. **Write atomically:** write to `<path>.tmp`, then rename to `<path>.md`
6. **Update DB index:** insert into `knowledge_notes`

#### 8.3.2 Existing Note Update (Merge Strategy)

When a note with the same title already exists at the expected path:

1. **Read existing file content** (the full `.md` including frontmatter).
2. **Send existing content to the KB generation LLM** as part of the input (see "Existing Note Content" in 8.2). The prompt instructs the LLM to produce an updated version that:
   - Preserves user-added sections and edits
   - Integrates new information from the current debrief
   - Maintains existing [[wikilinks]] and adds new relevant ones
   - Does not duplicate content already present
3. **Show confirmation to the user** before writing:
   - *"[Note Title] already exists (last modified [date]). How would you like to proceed?"*
   - Options: **Merge** (LLM integrates new content) / **Replace** (full overwrite) / **Create Separate** (appends ` (2)` to title) / **Skip**
4. **Backup before overwriting:** copy existing file to `<path>.bak` before writing the new version. Keep only the most recent `.bak` per file.
5. **Update frontmatter:** preserve `created` date, update `updated` date, append new tags (deduplicated), update `source_commit` to latest.
6. **Write atomically and update DB index.**

#### 8.3.3 Title Collision Handling

If the LLM generates a title that matches an existing note from a **different category** (e.g., existing `concepts/security/Rate Limiting.md` but the new note targets `patterns/Rate Limiting.md`):

- Treat as an update to the **existing** note (same concept, just categorized differently).
- Use the existing note's path, not the new category.
- Log the category mismatch for debugging.

### 8.4 KB Write Retry Strategy

```
For each selected note:

1. Assemble KB generation input (debrief context + existing note if updating)
2. Call LLM with KB profile (50k input cap, uncapped output with 16k fallback)
3. Parse response:
   a. Valid JSON with "title" and "content" → proceed to step 4
   b. JSON parse fails:
      - Attempt extraction: strip markdown fences, find outermost {}
      - If extraction succeeds → proceed to step 4
      - If extraction fails → RETRY (max 2 retries total)
        - On retry, append to user message:
          "Your previous response was not valid JSON.
           Respond ONLY with a JSON object: {\"title\": \"...\", \"content\": \"...\"}"
        - If all retries fail → mark this note as failed, continue with next note,
          surface error: "Failed to generate note: [title]. The model returned
          invalid responses after 3 attempts."
   c. Valid JSON but missing "content" field:
      - Log warning
      - If "title" is present but "content" is empty/missing → skip this note,
        surface info: "Note [title] was skipped — model returned empty content."
4. File write:
   a. Ensure target directory exists (mkdir -p)
   b. Write content to <target_path>.tmp
   c. Rename .tmp → .md
   d. If rename fails (permissions, disk full, invalid path):
      - Surface error with the attempted file path
      - Offer fallback: save to <kb_root>/unsorted/<sanitized_title>.md
      - If fallback also fails: return the generated content as plain text in the
        UI so the user can manually save it (no content is lost)
5. DB index update:
   a. Upsert knowledge_notes record (INSERT or UPDATE based on existing file_path)
   b. If DB write fails: the .md file still exists on disk — log warning,
      the file is accessible via filesystem even without index
```

### 8.5 Concurrent Write Protection

KB write operations must be serialized to prevent race conditions when multiple debriefs target the same note:

- Maintain a **write lock (Mutex) per normalized file path** in the KB service.
- Before starting any KB write, acquire the lock for the target path.
- If the lock is held, queue the write and process sequentially.
- Lock scope: per-file, not global. Writes to different notes proceed in parallel.

---

## 9. Database Schema Changes for Phase 3

### 9.1 Gaps Table — Add Detail Columns

```sql
ALTER TABLE gaps ADD COLUMN explanation TEXT NOT NULL DEFAULT '';
ALTER TABLE gaps ADD COLUMN suggestion TEXT NOT NULL DEFAULT '';
```

### 9.2 Knowledge Notes Table — Add Source Tracking

```sql
ALTER TABLE knowledge_notes ADD COLUMN source_debrief_id INTEGER REFERENCES debriefs(id) ON DELETE SET NULL;
ALTER TABLE knowledge_notes ADD COLUMN source_commit TEXT;
ALTER TABLE knowledge_notes ADD COLUMN links_to TEXT NOT NULL DEFAULT '[]';
```

- `source_debrief_id`: links the note to the debrief that generated it (enables "regenerate" and provenance tracking).
- `source_commit`: stored for Obsidian frontmatter without requiring a join to debriefs.
- `links_to`: JSON array of wikilink target titles. Stored in DB for cross-reference queries without parsing every `.md` file on disk.

---

## 10. LLM Request Error Handling

### 10.1 Timeout Policy

- Default request timeout: **120 seconds** for debrief generation, **90 seconds** for KB note generation.
- If a request times out, surface a clear message: *"Analysis timed out after [N] seconds. This may indicate a slow model or network issue. Try again or switch to a faster model."*
- Do **not** automatically retry on timeout (the user may want to switch models or reduce depth).

### 10.2 Rate Limit and Network Errors

- On HTTP 429 (rate limit): surface the error with the provider's `retry-after` header value if present. *"Rate limited by [provider]. Try again in [N] seconds."*
- On HTTP 5xx (server error): retry once after a 3-second delay. If the retry also fails, surface the error.
- On network errors (connection refused, DNS failure): surface immediately with the configured endpoint URL so the user can verify their settings.

### 10.3 Streaming (Future Enhancement)

For MVP, all LLM requests are synchronous (non-streaming). The UI shows a loading state while waiting.

Streaming support (showing the debrief as it generates) is a valuable UX improvement but is deferred to a post-MVP iteration. When implemented:
- Use SSE (Server-Sent Events) from the provider's streaming endpoint.
- Stream the raw JSON text to the frontend.
- Parse and render incrementally as complete JSON fields become available.

---

## 11. Final Message Assembly Order (summary)

The user message is assembled in this fixed order:

```
## Project Structure
[trimmed file tree]

## Commit Information
Hash: [commit_hash]
Message: [commit_message]
Author: [author]
Date: [commit_date]
Files changed: [n]

## Prior Context (last N reviews)
[history lines — omit section entirely if no history]

## Diff
[truncated or full diff content]

## Omitted Files Summary
[brief list of excluded or not-included files and reason — omit if nothing was excluded]
```

The system message:

```
[base system prompt]

## Analysis Depth: [Quick|Balanced|Deep]
[depth-specific instructions]

## Checkpoint Format
[mode-specific instructions]

## Active Skills

### Skill: [Name]
[skill content]

### Skill: [Name]
[skill content]
```

The system prompt is assembled first (after diff parsing for auto-skill detection) so the token meter knows how much budget remains for the user message.

---

## 12. Implementation Checklist (Phase 3)

### ai.rs — Core LLM Service

- [ ] Token counter utility function (approximate, model-agnostic, dual ratio: 3.5 chars/token for code, 4 chars/token for prose)
- [ ] Provider/model context-window validation (`>= 128k`) before analysis
- [ ] Output cap strategy: no cap by default, fallback to 16k with provider preference persistence
- [ ] Hard input cap enforced at 100k tokens
- [ ] JSON response parsing with extraction fallback and retry (rule 6.4)
- [ ] `schema_version` field in all responses
- [ ] Checkpoint mode conditional prompt injection (free_text vs multiple_choice)
- [ ] Analysis depth prompt injection (Quick/Balanced/Deep instructions, not token caps)
- [ ] Request metadata logging (endpoint, model, output cap field used, effective value)
- [ ] Timeout handling (120s debrief, 90s KB generation)
- [ ] Rate limit / network error handling with appropriate retries
- [ ] Estimated vs actual token count logging (when provider returns usage)

### context.rs — Context Assembly

- [ ] Diff parsing → auto-skill detection → system prompt assembly → budget calculation → user message assembly (correct dependency order)
- [ ] Risk-aware file prioritization before diff truncation
- [ ] Diff truncation with middle-collapse and priority-based include list
- [ ] Binary/generated file filter (lock files, minified via 500-char heuristic, build artifacts)
- [ ] Skill loading: manual (always full, never dropped) vs auto (full or drop, with relevance scoring)
- [ ] Auto-skill detection algorithm (rule 3.2.1: files, content_patterns, extensions against diff)
- [ ] Project structure builder (3-level, 100-entry cap, ignores respected)
- [ ] History query: last N reviewed debriefs for project (depth-dependent)
- [ ] History formatter: single-line summary per debrief
- [ ] Overflow cascade (steps 1–5 in rule 3.5)
- [ ] Pre-flight check: warn if manual skills exceed 70% of input cap
- [ ] Context reduction log stored in `ai_response_json`
- [ ] Suggested note count limits by depth (Quick: 0, Balanced: 3, Deep: 5)

### knowledge.rs — Knowledge Base Service

- [ ] Two-phase generation: debrief suggestions → separate LLM call on "Write to KB"
- [ ] KB generation LLM profile (50k input, uncapped output with 16k fallback)
- [ ] KB generation input assembly (debrief context + existing note + KB filesystem context)
- [ ] Filename sanitization (illegal chars, length cap at 200)
- [ ] Directory creation (`mkdir -p` for category paths)
- [ ] Atomic file writes (temp file + rename)
- [ ] Backup before overwrite (`.bak` file, keep most recent only)
- [ ] Merge strategy for existing notes (LLM-assisted merge with user confirmation)
- [ ] Title collision handling (same title in different category → update existing)
- [ ] Retry strategy for KB generation failures (max 2 retries, content-as-text fallback)
- [ ] Fallback write location (`unsorted/` directory if target path fails)
- [ ] Concurrent write protection (per-file Mutex)
- [ ] DB index upsert with new columns (`source_debrief_id`, `source_commit`, `links_to`)
- [ ] Frontmatter generation (YAML block with Obsidian-required fields)

### db/ — Schema Migration

- [ ] Migration 002: add `explanation` and `suggestion` columns to `gaps` table
- [ ] Migration 002: add `source_debrief_id`, `source_commit`, `links_to` columns to `knowledge_notes` table
- [ ] Update `create_gaps` to accept and store explanation + suggestion
- [ ] Update gap query methods to return explanation + suggestion
- [ ] Update `create_knowledge_note` to accept new columns
- [ ] Question ID assignment during debrief creation (`"q1"`, `"q2"`, `"q3"` from array index)

### commands/ — Tauri IPC

- [ ] `run_debrief` command (triggers full context assembly + LLM call + DB storage)
- [ ] `write_to_kb` command (triggers KB generation for selected suggested notes)
- [ ] `submit_checkpoint` command (stores response, triggers evaluation for free_text mode)
- [ ] All debrief/gap/checkpoint read commands (serve merged data to frontend)
- [ ] Settings commands (read/write, including pre-flight skill budget check)
