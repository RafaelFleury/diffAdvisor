# diffAdvisor - Project Plan

**AI-Powered Code Learning Companion for Junior Developers**

*Working title. Final name TBD.*

Open Source · BYOK · Cross-Platform · February 2026

---

## 1. Problem Statement

The software development industry is increasingly reliant on LLMs for code generation. While senior engineers leverage these tools to accelerate their workflow, junior developers and interns face a fundamentally different reality: they are pressured to use AI to meet delivery targets, but learn almost nothing in the process.

The result is a generation of developers who can operate prompts but cannot understand, debug, or architect the code they ship. They become what the industry is calling "prompt operators" rather than engineers.

Key issues observed in AI-generated code by junior developers:

- Zero security practices: no rate limiting, no input validation, no secrets management
- No understanding of edge cases, error handling, or production failure scenarios
- Missing foundational knowledge: authentication flows, database query performance, state management
- No awareness of what the AI decided for them (architectural patterns, trade-offs, technology choices)
- Code that works in demos but breaks at 10 real users

The core insight: with AI handling code generation, the most valuable knowledge for junior developers shifts from syntax-level understanding to architectural and behavioral comprehension. They need to understand what the code does in the system, what decisions were made, what is missing, and what breaks under pressure.

---

## 2. Solution

A cross-platform desktop application that monitors a project directory, analyzes code changes (diffs) from git commits, and provides educational debriefs powered by AI. The app acts as a senior engineer sitting next to the junior developer, explaining not what each line does, but what the code means architecturally, what decisions were implicitly made, and what critical gaps exist.

### 2.1 Core Philosophy

- Teach architecture and behavior, never line-by-line syntax
- Focus on what is MISSING from the code, not just what is there
- Integrate into the developer's existing workflow with zero friction
- Build a persistent, searchable knowledge base from every learning moment
- Treat AI-assisted coding as the norm, not a problem to fix

### 2.2 Distribution Model

- Open source (public repository)
- BYOK (Bring Your Own Key): users provide their own LLM API key
- Free to use, no SaaS billing, no telemetry

---

## 3. Architecture

### 3.1 Design Principles

The application follows a strictly modular architecture with clear separation between frontend, backend, and database layers. This serves two purposes:

1. **Maintainability:** new features after the MVP can be added to one layer without cascading changes across the entire codebase.
2. **Development strategy:** the frontend is built first with mock data, iterated on until the UX is solid, and only then connected to the real backend and database. This allows rapid UI iteration without needing a working AI pipeline.

### 3.2 Layer Separation

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND                          │
│              React + TypeScript                      │
│                                                      │
│   Pages ─── Components ─── Hooks ─── Stores          │
│                       │                              │
│              ┌────────┴────────┐                     │
│              │  Service Layer  │                     │
│              │  (interfaces)   │                     │
│              └────────┬────────┘                     │
│                       │                              │
│         ┌─────────────┼─────────────┐                │
│         │             │             │                │
│   MockService    TauriService   (future)             │
│   (dev/testing)  (production)                        │
└─────────┼─────────────┼─────────────────────────────┘
          │             │
          │    ┌────────┴────────┐
          │    │   TAURI BRIDGE  │
          │    │   (IPC commands)│
          │    └────────┬────────┘
          │             │
┌─────────┼─────────────┼─────────────────────────────┐
│         │        BACKEND (Rust)                      │
│         │             │                              │
│         │    ┌────────┴────────────────────┐         │
│         │    │                             │         │
│         │  git.rs   ai.rs   knowledge.rs  watcher.rs│
│         │    │        │         │                    │
│         │    │   ┌────┴────┐    │                    │
│         │    │   │ OpenAI  │    │                    │
│         │    │   │  SDK    │    │                    │
│         │    │   │ (HTTP)  │    │                    │
│         │    │   └─────────┘    │                    │
│         │    │                  │                    │
│         │  ┌─┴──────────────────┴──┐                 │
│         │  │     DATABASE LAYER    │                 │
│         │  │     db.rs (SQLite)    │                 │
│         │  └───────────────────────┘                 │
└──────────────────────────────────────────────────────┘
```

### 3.3 Service Layer (Frontend)

The frontend never calls Tauri or SQLite directly. All data access goes through a service interface:

```typescript
// src/services/types.ts - The contract
interface IDebriefService {
  getPendingCommits(projectId: string): Promise<Commit[]>;
  runDebrief(commitHash: string): Promise<DebriefResult>;
  submitCheckpoint(debriefId: string, answer: string): Promise<Evaluation>;
  markReviewed(debriefId: string): Promise<void>;
}

interface IKnowledgeService {
  getNotes(): Promise<KnowledgeNote[]>;
  getNote(path: string): Promise<string>;        // returns .md content
  saveNote(path: string, content: string): Promise<void>;
  searchNotes(query: string): Promise<KnowledgeNote[]>;
}

interface ISettingsService {
  getSettings(): Promise<AppSettings>;
  updateSettings(settings: Partial<AppSettings>): Promise<void>;
  getSkills(): Promise<Skill[]>;
  toggleSkill(skillId: string, enabled: boolean): Promise<void>;
}

// ... similar interfaces for projects, gaps, etc.
```

Two implementations exist:

```typescript
// src/services/mock.ts    - Returns hardcoded data, used during frontend development
// src/services/tauri.ts   - Calls Tauri IPC commands, used in production
```

A single flag or environment variable switches between them:

```typescript
// src/services/index.ts
import { MockDebriefService } from './mock';
import { TauriDebriefService } from './tauri';

export const debriefService = import.meta.env.DEV
  ? new MockDebriefService()
  : new TauriDebriefService();
```

This means the entire frontend can be built, tested, and iterated on without a working Rust backend.

### 3.4 Development Strategy

The project is developed in phases, using Claude Code for incremental implementation:

**Phase 1: Frontend with Mock Data**
- Build all 4 pages (Dashboard, Debrief, Knowledge Base, Settings)
- Implement MockService with realistic hardcoded data
- Iterate on UX/layout/interactions until solid
- All components are fully functional against mock data

**Phase 2: Database Layer**
- Implement SQLite schema and migrations
- Build db.rs with all CRUD operations
- Test database layer independently

**Phase 3: Backend Integration**
- Implement Tauri IPC commands
- Build git.rs (diff parsing, commit detection)
- Build ai.rs (OpenAI-compatible SDK calls, prompt assembly, skill injection)
- Build knowledge.rs (file operations, Obsidian-format generation)
- Build watcher.rs (file system monitoring)
- Create TauriService implementations that call IPC

**Phase 4: Connect Frontend to Backend**
- Switch service layer from Mock to Tauri
- Integration testing
- Polish and ship MVP

---

## 4. Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Desktop Framework | **Tauri 2** (Rust + Webview) | Lightweight, native filesystem access, cross-platform (Linux, Windows, macOS). Much lower memory footprint than Electron. |
| Frontend | **React** + TypeScript | Component-based UI, strong typing, large ecosystem. |
| Styling | **Tailwind CSS** | Utility-first, fast iteration, consistent design tokens for the grayscale palette. |
| Database | **SQLite** (tauri-plugin-sql) | Local-first, no server dependency. Stores debrief history, checkpoint responses, gap tracking, and knowledge base index. |
| Diff Viewer | **Monaco Editor** | Same engine as VS Code. Built-in diff rendering, syntax highlighting for all major languages. |
| Markdown Rendering | **remark / marked** | Renders Obsidian-formatted .md files in the knowledge base with syntax-highlighted code blocks and Wikilink support. |
| File Watching | **notify** (Rust crate) | Watches .git directory for new commits. Low overhead, native OS events. |
| AI Communication | **OpenAI SDK** (openai-compatible) | See section 4.1 below. |

### 4.1 AI Provider: OpenAI-Compatible Endpoint

The app communicates with AI models exclusively via the **OpenAI-compatible `/v1/chat/completions` endpoint**. The endpoint URL is fully configurable, which means the app natively supports any provider that implements this API format:

| Provider | Endpoint URL | Notes |
|----------|-------------|-------|
| OpenAI | `https://api.openai.com/v1` | GPT-4.1, GPT-4.1-mini, etc. |
| Anthropic | `https://api.anthropic.com/v1` (via compatible proxy) | Claude Sonnet 4, Opus 4 (requires proxy or compatible wrapper) |
| Ollama | `http://localhost:11434/v1` | Local models, no API key needed |
| LM Studio | `http://localhost:1234/v1` | Local models, no API key needed |
| Groq | `https://api.groq.com/openai/v1` | Llama, Mixtral, etc. |
| Together | `https://api.together.xyz/v1` | Wide model selection |
| Any compatible | User-defined URL | Any `/v1/chat/completions` endpoint |

Settings configuration:

```
Endpoint URL:  [https://api.openai.com/v1          ]
Model:         [gpt-4.1                             ]
API Key:       [sk-••••••••••••••••          ] [Test]
```

The user types the endpoint URL, model name, and API key. The "Test" button sends a minimal completion request to validate the connection. API Key is optional (local models like Ollama don't require one).

This approach future-proofs the app against new providers and gives users full control, including the ability to run local models for free via Ollama or LM Studio.

Request format:

```json
{
  "model": "user-configured-model-name",
  "messages": [
    {
      "role": "system",
      "content": "[base system prompt] + [active skills content]"
    },
    {
      "role": "user",
      "content": "[assembled context: diff, project structure, history]"
    }
  ],
  "temperature": 0.3,
  "response_format": { "type": "json_object" }
}
```

All requests use `response_format: { "type": "json_object" }` to request JSON output. The system prompt also instructs JSON-only output. The backend assumes the response is valid JSON and parses it directly. If parsing fails (e.g., model returns markdown-wrapped JSON or explanatory text), the backend falls back to: extract JSON from the raw string (e.g., strip markdown code fences, find the outermost `{...}` block), then parse; if that fails, surface a clear error to the user and optionally retry.

### 4.2 Project Structure

```
diffAdvisor/
├── src-tauri/                     # BACKEND (Rust)
│   ├── src/
│   │   ├── main.rs                # Tauri app setup, IPC command registration
│   │   ├── commands/              # Tauri IPC command handlers
│   │   │   ├── mod.rs
│   │   │   ├── projects.rs
│   │   │   ├── debriefs.rs
│   │   │   ├── knowledge.rs
│   │   │   └── settings.rs
│   │   ├── services/              # Business logic (no Tauri dependency)
│   │   │   ├── mod.rs
│   │   │   ├── git.rs             # Git operations (diff, log, commit parsing)
│   │   │   ├── ai.rs              # OpenAI-compatible API calls, prompt assembly
│   │   │   ├── skills.rs          # Skill loading, detection, injection
│   │   │   ├── knowledge.rs       # Knowledge base file management
│   │   │   └── watcher.rs         # File system watcher for .git
│   │   └── db/                    # Database layer
│   │       ├── mod.rs
│   │       ├── schema.rs          # Table definitions, migrations
│   │       ├── projects.rs        # Project CRUD
│   │       ├── debriefs.rs        # Debrief CRUD
│   │       ├── gaps.rs            # Gap tracking CRUD
│   │       ├── checkpoints.rs     # Checkpoint response CRUD
│   │       ├── knowledge.rs       # Knowledge note index CRUD
│   │       └── settings.rs        # Settings key-value CRUD
│   ├── skills/                    # Built-in skills (shipped with app)
│   │   ├── security-general.md
│   │   ├── nodejs-express.md
│   │   ├── react.md
│   │   ├── django.md
│   │   ├── nextjs.md
│   │   ├── sql-databases.md
│   │   └── rest-api.md
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── src/                           # FRONTEND (React + TypeScript)
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Debrief.tsx
│   │   ├── KnowledgeBase.tsx
│   │   └── Settings.tsx
│   ├── components/
│   │   ├── DiffViewer.tsx
│   │   ├── DebriefPanel.tsx
│   │   ├── GapAlert.tsx
│   │   ├── CheckpointQuestion.tsx
│   │   ├── KnowledgeTree.tsx
│   │   ├── MarkdownRenderer.tsx
│   │   ├── SkillManager.tsx
│   │   ├── PromptEditor.tsx
│   │   └── ProjectSelector.tsx
│   ├── services/                  # Service layer (abstraction)
│   │   ├── types.ts               # Interfaces / contracts
│   │   ├── mock.ts                # Mock implementation (dev)
│   │   ├── tauri.ts               # Tauri IPC implementation (prod)
│   │   └── index.ts               # Service factory (switches mock/tauri)
│   ├── hooks/
│   ├── stores/
│   ├── types/                     # Shared TypeScript types
│   ├── App.tsx
│   └── main.tsx
│
├── package.json
└── README.md
```

Note how the backend is further split: `commands/` handles Tauri IPC concerns only (argument parsing, response formatting), `services/` contains pure business logic (testable without Tauri), and `db/` isolates all SQLite operations. This means `ai.rs` can be unit-tested by mocking the HTTP client, `git.rs` can be tested against a temp git repo, and so on.

---

## 5. Skills System

### 5.1 What Skills Are

Skills are markdown files (`.md`) that contain additional context and instructions injected into the AI's system prompt for a specific analysis. Each skill focuses on a domain: a framework, a language concern, a security topic, or any other area of expertise.

Example skill file (`nodejs-express.md`):

```markdown
---
name: Node.js / Express
detect:
  files: ["package.json"]
  content_patterns: ["express", "fastify", "koa"]
  extensions: [".js", ".ts", ".mjs"]
tags: [backend, javascript, node]
---

## Express-Specific Concerns

When analyzing Express.js code, pay special attention to:

### Middleware Order
Express middleware executes in registration order. Flag if:
- Error handling middleware is not registered last
- Authentication middleware comes after route handlers
- Body parsing middleware is missing before routes that read req.body

### Security Headers
Check for helmet or manual security header configuration.
Flag if the app serves responses without:
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Strict-Transport-Security (if HTTPS)

### Async Error Handling
Express does not catch async errors by default before v5.
Flag if async route handlers don't use try/catch or an
async wrapper like express-async-errors.

### Common Express Pitfalls
- Not calling next() in middleware (request hangs forever)
- Using app.use() with a path that shadows other routes
- Trusting req.ip without configuring trust proxy
- Not setting appropriate timeouts on the server
```

### 5.2 Skill Detection and Activation

Skills have two activation modes:

**Auto-detection (default):** When a project is added or analyzed, the app reads the project's file tree and file contents to match against each skill's `detect` block:
- `files`: checks if specific files exist in the project root (e.g., `package.json`, `requirements.txt`, `Cargo.toml`)
- `content_patterns`: checks if those files contain specific strings (e.g., `"express"` in package.json)
- `extensions`: checks if the project contains files with these extensions

If a skill's detection criteria match, it is automatically suggested and enabled for that project. The user sees which skills were auto-detected and can disable any of them.

**Manual override:** The user can enable or disable any skill for any project regardless of auto-detection results. They can also enable skills that weren't auto-detected (e.g., enabling the SQL skill for a project that uses an ORM where the database dependency isn't obvious).

### 5.3 Skill Storage

Skills live in two locations:

- **Built-in skills:** Ship with the app at `src-tauri/skills/`. These are copied to `~/.diffAdvisor/skills/builtin/` on first launch. The user can edit these copies freely.
- **User skills:** Created by the user at `~/.diffAdvisor/skills/user/`. Any `.md` file in this directory following the frontmatter format is recognized as a skill.

The Settings page shows both categories and allows editing, creating, and toggling skills.

### 5.4 Skill Injection into Prompt

When assembling the AI prompt for a debrief, the backend:

1. Reads the base system prompt (which may have been edited by the user)
2. Identifies which skills are active for the current project
3. Appends each active skill's content after the base prompt, wrapped in a clear delimiter:

```
[base system prompt]

## Active Skills

### Skill: Node.js / Express
[content of nodejs-express.md, without frontmatter]

### Skill: SQL Databases
[content of sql-databases.md, without frontmatter]

### Skill: Security General
[content of security-general.md, without frontmatter]
```

This keeps the base prompt clean and makes skills additive and composable.

### 5.5 Built-in Skills (Shipped with MVP)

| Skill File | Detects Via | Covers |
|-----------|-------------|--------|
| `security-general.md` | Always active | OWASP top 10, secrets management, input validation, rate limiting, CORS |
| `nodejs-express.md` | package.json containing "express" | Middleware order, async errors, security headers, trust proxy |
| `react.md` | package.json containing "react" | State management, useEffect pitfalls, key prop, re-render performance |
| `nextjs.md` | package.json containing "next" | SSR/SSG trade-offs, API routes security, middleware, caching |
| `django.md` | requirements.txt containing "django" | ORM N+1, CSRF, model validation, migration safety |
| `sql-databases.md` | .sql files or ORM dependencies detected | Query performance, N+1, indexing, injection, transactions |
| `rest-api.md` | Route/endpoint files detected | HTTP methods, status codes, versioning, pagination, error format |

---

## 6. Database Schema

All data is stored locally in SQLite. The knowledge base content lives as .md files on disk; the database holds metadata and index for fast search. All knowledge base .md files are expected to be Obsidian documents (see section 7.3).

### projects

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment primary key |
| name | TEXT | Project display name |
| path | TEXT | Absolute path to project directory |
| language | TEXT | Primary language detected |
| frameworks | TEXT | Detected frameworks (JSON array) |
| active_skills | TEXT | JSON array of enabled skill IDs for this project |
| created_at | DATETIME | When the project was added |
| last_analyzed_at | DATETIME | Timestamp of last debrief |

### debriefs

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment primary key |
| project_id | INTEGER FK | References projects.id |
| commit_hash | TEXT | Git commit SHA |
| commit_message | TEXT | Commit message |
| diff_content | TEXT | Full diff content |
| ai_response_json | TEXT | Full structured AI response |
| skills_used | TEXT | JSON array of skill IDs used for this debrief |
| status | TEXT | pending \| reviewed |
| created_at | DATETIME | When the debrief was generated |

### checkpoint_responses

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment primary key |
| debrief_id | INTEGER FK | References debriefs.id |
| question_text | TEXT | The checkpoint question asked |
| response_text | TEXT | The user's answer |
| ai_evaluation_json | TEXT | AI evaluation of the answer (nullable) |
| mode | TEXT | free_text \| multiple_choice |
| created_at | DATETIME | When the response was submitted |

### gaps

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment primary key |
| debrief_id | INTEGER FK | References debriefs.id |
| severity | TEXT | critical \| warning \| info |
| category | TEXT | security \| performance \| reliability \| maintainability |
| description | TEXT | Short description of the gap |
| resolved | BOOLEAN | Whether the user addressed this gap |
| created_at | DATETIME | When the gap was detected |

### knowledge_notes

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment primary key |
| project_id | INTEGER FK | References projects.id (nullable for global notes) |
| title | TEXT | Note title |
| category_path | TEXT | e.g. concepts/security |
| file_path | TEXT | Path to the .md file on disk |
| auto_generated | BOOLEAN | Whether created automatically from a debrief |
| tags | TEXT | Comma-separated tags for search |
| created_at | DATETIME | Creation timestamp |
| updated_at | DATETIME | Last modification timestamp |

### settings

| Column | Type | Description |
|--------|------|-------------|
| key | TEXT PK | Setting identifier |
| value | TEXT | Setting value (JSON-encoded for complex values) |

---

## 7. Application Pages

### 7.1 Dashboard

The landing page. Shows the current monitored project, pending and reviewed commits, and summary statistics.

**Elements:**

- Project path indicator at the top
- 3 stat cards: Pending Reviews (count), Reviewed (count), Gaps Found (total)
- Pending commits list: each card shows commit hash, message, time, files changed, additions/deletions, and a "pending" badge. Clickable to open the Debrief page.
- Reviewed commits list: same layout with "reviewed" badge and slightly dimmed opacity

**Behavior:**

- The app monitors the project's .git directory using a file watcher (notify crate)
- When new commits are detected, they appear in the pending list with a notification/badge
- Default behavior: manual analysis (user clicks to trigger). Auto-analyze can be enabled in Settings.

### 7.2 Debrief

The central page of the app. A split-view interface where the user reviews AI-analyzed code changes.

**Layout:**

- Header bar: back button, commit message, commit hash, "Save to KB" button, "Mark Reviewed" button
- Split view: left panel (55% default) shows the diff, right panel (45% default) shows the debrief content
- The divider between panels is draggable (resizable between 30% and 75%)

**Left Panel - Diff View:**

- Rendered using Monaco Editor in diff mode
- Syntax-highlighted with line numbers
- Color-coded: green for additions, red for deletions
- File name and change stats (+/- lines) shown at the top

**Right Panel - Debrief Content (4 collapsible sections):**

- **Architectural Overview:** 2-3 sentences explaining what the code does at a system level. Lists identified design patterns as tags.
- **Decisions Made:** Each decision the AI made (often implicitly), with alternatives and trade-offs explained.
- **Gaps Found:** Color-coded alerts by severity (critical/warning/info) and category (security/performance/reliability/maintainability). Each gap includes a description, explanation of why it matters, and a concrete suggestion.
- **Checkpoint:** 2-3 questions that test behavioral and architectural understanding. Tabs for each question (Q1, Q2, Q3). Text area for free-text answers or multiple-choice options depending on settings. After submission, the AI evaluates the answer.

### 7.3 Knowledge Base

A universal, Obsidian-compatible knowledge vault stored as .md files in a user-configured directory. The knowledge base is shared across all monitored projects, creating a single source of truth for the developer's accumulated learning.

**Obsidian document format (required):**

All `.md` files in the knowledge base—whether auto-generated, manually created, or template notes—are expected to be written as **Obsidian documents**. This means they must follow Obsidian's markdown syntax and conventions so they render correctly in Obsidian and work with its graph, search, and plugin ecosystem. See [Obsidian Help - Basic formatting](https://help.obsidian.md/syntax) and [Obsidian Flavored Markdown](https://help.obsidian.md/obsidian-flavored-markdown) for the canonical syntax reference.

**Why Obsidian-compatible:**

The knowledge base directory is a standard Obsidian vault. All notes are written in Obsidian-flavored markdown, meaning the developer can open the same folder in Obsidian for advanced graph visualization, search, and plugin ecosystem access. The app generates notes that Obsidian understands natively, so the user can switch between tools seamlessly.

**Obsidian formatting rules for knowledge base notes:**

- **Internal links (Wikilinks):** Use `[[double brackets]]` syntax: e.g., `See also: [[JWT Authentication]]`, `Related: [[Rate Limiting]]`. For custom display text: `[[Note Title|Display text]]`. Links can target headings: `[[Note#Section heading]]`.
- **Link resolution:** Notes reference other notes by title (not file path), letting Obsidian resolve links automatically. Unresolved links (notes that don't exist yet) are valid—Obsidian shows them as creation opportunities.
- **YAML frontmatter:** Each note includes a YAML properties block at the top, enclosed by `---` delimiters:
  ```yaml
  ---
  title: JWT Authentication
  tags: [security, authentication, stateless]
  category: concepts/security
  source_project: e-commerce-api
  source_commit: a3f7c2d
  auto_generated: true
  created: 2026-02-16
  ---
  ```
- **Tags:** Use the plural `tags` property as a YAML list (e.g., `tags: [security, authentication]`). Obsidian 1.9+ deprecated singular `tag`; the list format is required for the tag pane and search.
- **Aliases:** Declare alternative names in frontmatter when a concept has multiple names: `aliases: [JSON Web Token, JWT token]`. Use plural `aliases` as a list.
- **Aggressive linking:** Notes link to related concepts aggressively: if a note about JWT mentions rate limiting, it links to `[[Rate Limiting]]` even if that note doesn't exist yet (Obsidian handles unresolved links gracefully and shows them as creation opportunities).
- **Headings:** Use standard markdown headers (`#`, `##`, `###`) for Obsidian's outline view.
- **Code blocks:** Include language identifiers (e.g., `javascript`, `python`) for syntax highlighting.

**Universal storage model:**

The knowledge base path is configured in Settings (default: `~/knowledge_base`). This is a single directory shared across all projects. Notes generated from any project are filed into the same structure, cross-linking concepts regardless of where they were first encountered. A note about "N+1 Queries" created from the e-commerce project can be linked to from a debrief on a completely different project.

**Layout:**

- Left sidebar (260px): search bar, "New Note" button, folder tree with expandable categories
- Right content area: markdown rendering with syntax highlighting, breadcrumb navigation, auto-generated badge on notes created from debriefs

**Knowledge Sources:**

- **Auto-generated notes:** Created when the user clicks "Save to KB" in a debrief. The AI generates an Obsidian-formatted .md note with frontmatter, internal `[[links]]`, and contextual content tied to the developer's real project.
- **Manual notes:** The user can create and edit their own notes directly in the app. These must also be written as Obsidian documents.
- **Template notes:** Pre-built reference checklists (e.g., pre-deploy security, production readiness) that ship with the app. Formatted as Obsidian documents with links to related concepts.

**File Structure:**

All files below are Obsidian documents (.md with YAML frontmatter, Wikilinks, and standard Obsidian syntax):

```
knowledge_base/                          # User-configured path (Obsidian vault)
├── languages/
│   ├── javascript/
│   │   ├── Event Loop.md
│   │   ├── Closures & Scope.md
│   │   └── Promises & Async Await.md
│   └── python/
│       └── Decorators.md
├── concepts/
│   ├── security/
│   │   ├── JWT Authentication.md        # Contains [[Rate Limiting]], [[Input Validation]]
│   │   ├── Input Validation.md          # Contains [[SQL Injection]], [[Server-Side Validation]]
│   │   └── Rate Limiting.md
│   └── architecture/
│       ├── REST API Design.md
│       └── Middleware Pattern.md         # Contains [[Chain of Responsibility]]
├── checklists/
│   ├── Pre-Deploy Security.md           # Links to all relevant concept notes
│   └── Production Readiness.md
└── templates/                           # Shipped with the app
    └── New Concept Note.md
```

Note: file names use readable titles (not slugs) because Obsidian resolves `[[links]]` by title matching, making spaces and natural names preferable.

### 7.4 Settings

All user-configurable options, organized into sections. All changes take effect immediately without restarting the app.

**Project:**

- Monitored directory: file path selector with Browse button
- File extensions to monitor (e.g., .ts, .tsx, .js, .py, .rs)
- Ignored paths (e.g., node_modules, .git, dist, __pycache__)

**AI Provider:**

- Endpoint URL: text input (e.g., `https://api.openai.com/v1`, `http://localhost:11434/v1`)
- Model: text input (e.g., `gpt-4.1`, `claude-sonnet-4-20250514`, `llama3`)
- API Key: masked input with "Test Connection" button (optional for local models)
- Web Search: toggle to enable searching for CVEs and best practices during analysis

**System Prompt:**

- Full-height text editor showing the current system prompt
- Editable in-place: the user types directly into the editor
- Save button to persist changes
- "Reset to Default" button to restore the original prompt
- Changes apply to the next debrief without restarting the app

**Skills:**

- List of all available skills (built-in + user-created)
- Each skill shows: name, detection status (auto-detected / manually enabled / disabled), tags
- Toggle switch per skill to enable/disable for the current project
- "Edit" button opens the skill's .md content in an editor within the app
- "New Skill" button creates a blank skill template in `~/.diffAdvisor/skills/user/`
- "Open Skills Folder" button opens the filesystem directory

**Analysis:**

- Auto-Analyze on Commit: toggle (default: off). When enabled, debriefs are generated automatically on new commits.
- Checkpoint Mode: Free Text (deeper learning, extra API call for evaluation) or Multiple Choice (faster, generated with the debrief)
- Analysis Depth: Quick / Balanced / Deep. Controls explanation length and number of checkpoint questions.

**Knowledge Base:**

- Storage path: where the knowledge base vault is located (default: `~/knowledge_base`). This is a universal directory shared across all projects. Can be pointed at an existing Obsidian vault.
- Auto-generate notes: toggle to automatically create .md notes from debriefs

**Appearance:**

- Theme: Light / Dark (grayscale palette, colors only for diffs and severity badges)
- Debrief Language: English / Portuguese / Auto-detect

---

## 8. System Prompt

The system prompt is the base instruction set for the AI agent. It is editable in Settings and changes apply immediately. Below is the default prompt that ships with the app:

```
You are a senior software engineer mentor embedded in a learning
tool for junior developers. Your role is to analyze code changes
(diffs) and provide educational, critical, and architectural
feedback.

## Your Core Principles

1. NEVER explain code line by line. Always explain at the
   architectural and behavioral level. What does this code DO in
   the system? What pattern does it follow? What are the
   implications?

2. ALWAYS look for what's MISSING, not just what's there. The
   most important feedback is about what the developer forgot or
   what the AI that generated the code ignored.

3. Be direct, not condescending. The developer is using AI to
   write code - that's fine. Your job is to make sure they
   UNDERSTAND what they're shipping.

## Security & Production Readiness Checklist

For EVERY code change, evaluate against this checklist and flag
anything missing or incorrectly implemented:

- Rate limiting on endpoints
- Row Level Security on database queries
- CAPTCHA on authentication and public-facing forms
- Server-side validation (never trust client-side only)
- API keys and secrets management (no hardcoded values)
- Environment variables properly configured
- CORS restrictions appropriate for the use case
- Dependency audit (known vulnerabilities in packages)
- Input sanitization against injection attacks
- Authentication and authorization on every protected route
- Error handling that doesn't leak internal information
- Logging that captures enough for debugging but not sensitive data

## Edge Cases & Production Concerns

Always consider and flag when relevant:
- Concurrent users / race conditions
- Error handling for external service failures
- State management consistency
- Database query performance (N+1, missing indexes)
- Offline behavior / network failure handling
- Memory leaks or resource cleanup
- Data validation at system boundaries
- Graceful degradation when dependencies fail

## Knowledge Base Note Generation

When generating knowledge_base_notes, output Obsidian-compatible markdown. All notes must follow Obsidian document format:
- Use [[double bracket links]] (Wikilinks) to reference related concepts
- Link aggressively: if a concept is mentioned, link it
- Write for the developer's project context, not generic tutorials
- Include concrete code examples from the analyzed diff when useful
- Keep notes concise and scannable
- Suggest tags that map to the concept's domain

## Response Format

Respond ONLY with valid JSON in this structure:
{
  "architectural_summary": "2-3 sentences explaining WHAT this
    code does in the system at an architectural level",
  "patterns_identified": ["list of design patterns or
    architectural decisions present in the code"],
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
      "category": "security | performance | reliability |
        maintainability",
      "description": "what's missing or wrong",
      "explanation": "why this matters in production",
      "suggestion": "what should be done"
    }
  ],
  "checkpoint_questions": [
    {
      "question": "a behavioral/architectural question that tests
        understanding, not memorization",
      "concept": "the underlying concept being tested",
      "good_answer_includes": "key points a good answer would
        cover"
    }
  ],
  "knowledge_base_notes": [
    {
      "title": "concept name (used as filename and link target)",
      "category": "suggested category path",
      "tags": ["list", "of", "tags"],
      "links_to": ["other concept titles to [[link]] to"],
      "content": "markdown body (without frontmatter, app adds it)"
    }
  ]
}

## Important Rules

- Generate 2-3 checkpoint questions per debrief, not more
- Questions should test BEHAVIOR and CONSEQUENCES, never syntax
- Flag a maximum of 5 gaps per debrief, prioritized by severity
- If the code is actually well-written, say so. Don't manufacture
  problems.
- When flagging gaps, always explain WHY it matters with a
  concrete scenario
- Adapt your language complexity to the developer's level
- Reference the project's own code in examples when possible
```

---

## 9. Daily User Flow

1. **Developer opens the app.** It is already monitoring the project directory configured in settings. Skills relevant to the project were auto-detected on first setup.
2. **Developer works normally.** They use AI to generate code, make changes, and commit as usual.
3. **App detects new commits.** A badge or notification appears on the dashboard: "2 commits not reviewed".
4. **Developer clicks to review.** The AI analyzes the diff using the base prompt + active skills and generates a debrief.
5. **Developer reads the debrief.** They see the architectural summary, the decisions the AI made for them, and the gaps in security/performance. Skills provide framework-specific insights (e.g., Express middleware order issues).
6. **Developer answers checkpoint questions.** These test whether they understood the behavior and consequences, not the syntax.
7. **Developer saves to Knowledge Base.** Key concepts from the debrief are saved as Obsidian-compatible .md notes with `[[internal links]]` and frontmatter, filed into the universal knowledge base.
8. **Developer marks as reviewed.** The commit moves to the reviewed list. Total time: 5-10 minutes per commit.
9. **(Optional) Developer opens Obsidian.** The same knowledge base folder can be opened in Obsidian for graph visualization, advanced search, and exploring connections between concepts across all projects.

---

## 10. Design Language

### 10.1 Color Palette

The interface is strictly grayscale. Color is reserved exclusively for functional indicators:

- UI chrome: white, black, and shades of gray (no accent colors)
- Diff additions: green tones
- Diff deletions: red tones
- Gap severity: critical = red, warning = amber, info = blue
- Success states: green
- Markdown syntax highlighting: standard code theme colors
- Everything else: grayscale

### 10.2 Typography

- **Monospace (JetBrains Mono):** all code, labels, stats, badges, navigation, buttons
- **System sans-serif:** body text in debrief explanations and knowledge base prose

### 10.3 Layout Principles

- Narrow icon sidebar (56px) for navigation, not a full sidebar with labels
- Content areas use generous padding and whitespace
- Cards with subtle borders, no heavy shadows
- Collapsible sections to manage information density
- Light/dark theme toggle in the sidebar footer

### 10.4 Themes

- **Light theme:** white backgrounds, light gray cards, dark text
- **Dark theme:** near-black backgrounds (#0a0a0a), dark gray cards, light text
- Both themes maintain the same functional color mappings for diffs and severity

---

## 11. Future Considerations

Features that are out of scope for the MVP but worth considering for future versions:

- VS Code extension: debrief panel directly in the editor sidebar
- Competency map: visual representation of which parts of the codebase the developer understands
- Team mode: aggregated gap statistics for engineering managers
- Custom checklist plugins: teams can add their own review criteria
- Git hook integration: optional pre-push reminder if critical gaps were not addressed
- Export: generate reports of learning progress over time
- Community skill repository: shared skill packs contributed by the community