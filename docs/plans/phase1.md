# Phase 1: Frontend with Mock Data — Implementation Plan

## Context

diffAdvisor is a Tauri 2 desktop app that analyzes git diffs with AI to teach junior developers. The project is currently a blank slate (only docs, LICENSE, README). Phase 1 builds the complete frontend with mock data so the UI can be developed and iterated independently of the Rust backend.

**Outcome:** A fully functional 4-page desktop app running on Tauri 2, powered by mock data through a service layer abstraction. All pages interactive, theme switching works, navigation works. Comprehensive unit and component tests validate all layers independently.

---

## Backend-Agnostic Architecture

The frontend is **completely decoupled from any backend**. No component, page, store, or hook ever imports Tauri APIs, calls IPC directly, or assumes where data comes from. Everything flows through a **service layer** defined by TypeScript interfaces.

### How It Works

```
Component / Page
      │
      ▼
  Zustand Store  ← calls service methods, stores results
      │
      ▼
  Service Interface (IDebriefService, IProjectService, etc.)
      │
      ├── MockService    ← Phase 1: hardcoded data, simulated delays
      ├── TauriService   ← Phase 3: calls Tauri IPC commands
      └── (future)       ← could be REST, WebSocket, anything
```

### The Contract

Service interfaces in `src/services/types.ts` define the **exact data shapes** the frontend expects. These interfaces are the contract between frontend and backend. When building the real backend later, the Tauri IPC commands must return data matching these same types — no frontend changes needed.

```typescript
// Example: the frontend expects this shape, period.
interface IDebriefService {
  getPendingCommits(projectId: string): Promise<Commit[]>;
  runDebrief(commitHash: string): Promise<DebriefResult>;
  submitCheckpoint(debriefId: string, questionId: string, answer: string): Promise<Evaluation>;
  markReviewed(debriefId: string): Promise<void>;
}
```

### Mock Data Requirements

The mock service is NOT a throwaway — it serves as the **reference implementation** of the contract. It must:

1. **Return the exact types** defined in the interfaces (TypeScript enforces this at compile time)
2. **Cover all edge cases** the UI must handle: empty lists, long text, maximum gaps, notes with/without wikilinks, skills that are auto-detected vs manually enabled
3. **Simulate async behavior** with realistic delays (200-400ms) so loading states are visible and race conditions surface during development
4. **Be stateful within a session** — marking a commit as reviewed moves it from pending to reviewed, saving a note makes it appear in the knowledge base, toggling a skill persists until refresh
5. **Validate that the UI degrades gracefully** — include mock error scenarios (e.g., `testConnection()` can return `{ success: false, message: "Connection refused" }`)

### Switching Implementations

A single check in `src/services/index.ts` controls which implementation is active:

```typescript
const USE_MOCK = import.meta.env.DEV;
export const debriefService = USE_MOCK ? new MockDebriefService() : new TauriDebriefService();
```

When Phase 3 builds `TauriDebriefService`, it implements the same `IDebriefService` interface. The frontend doesn't change — it already works against the contract.

### Rules

- **No component may import from `./mock` or `./tauri` directly.** Always import from `./services/index.ts`.
- **No store may assume the data source.** Stores call service methods and handle the returned `Promise`.
- **Types live in `src/types/`, not in service files.** Both mock and tauri services import from the same types.

---

## Tech Stack

| Concern | Choice |
|---------|--------|
| Desktop framework | Tauri 2 |
| Frontend | React + TypeScript + Vite |
| Styling | Tailwind CSS |
| State management | Zustand |
| Routing | React Router |
| Diff viewer | Monaco Editor (`@monaco-editor/react`) |
| Markdown | `react-markdown` + `remark-gfm` + `rehype-highlight` |
| Notifications | `react-hot-toast` |
| Font | JetBrains Mono (monospace), system sans-serif (body) |
| Package manager | pnpm |

---

## Implementation Steps

### Step 1: Project Scaffolding

- Initialize Tauri 2 project with React + TypeScript template
- Install all dependencies (see Dependencies section below)
- Configure Tailwind CSS with custom grayscale palette, JetBrains Mono, functional colors (diff green/red, severity critical/warning/info)
- Configure ESLint + Prettier
- Create `.gitignore` (node_modules, dist, src-tauri/target, .env, etc.)
- Import JetBrains Mono font via Google Fonts in `src/index.css`

### Step 2: TypeScript Types

Create `src/types/` with all shared type definitions:

- `project.ts` — `Project` (id, name, path, language, frameworks, activeSkills, dates)
- `commit.ts` — `Commit` (hash, message, author, timestamp, filesChanged, additions, deletions, status), `CommitStatus`
- `debrief.ts` — `DebriefResult`, `Decision`, `Gap`, `Severity`, `GapCategory`
- `checkpoint.ts` — `CheckpointQuestion`, `CheckpointResponse`, `Evaluation`, `CheckpointMode`
- `knowledge.ts` — `KnowledgeNote`, `KnowledgeCategory`
- `skill.ts` — `Skill`, `SkillDetectConfig`
- `settings.ts` — `AppSettings`, `ProjectSettings`, `AISettings`, `AnalysisSettings`, `KnowledgeSettings`, `AppearanceSettings`, `Theme`, `AnalysisDepth`
- `index.ts` — re-exports

### Step 3: Service Layer

Create `src/services/`:

- **`types.ts`** — Service interfaces: `IProjectService`, `IDebriefService`, `ICheckpointService`, `IKnowledgeService`, `ISettingsService`
- **`mock.ts`** — Full mock implementations with realistic data:
  - 2-3 sample projects
  - 8-10 commits (mix of pending/reviewed) with real-looking diff content
  - 2-3 complete debriefs (summary, patterns, decisions, gaps, checkpoints, KB notes)
  - 10-15 knowledge notes across categories with Obsidian wikilinks
  - All 7 built-in skills from spec
  - Complete default settings
  - Simulated async delays (~200-400ms)
- **`tauri.ts`** — Stub implementations (throws "not implemented")
- **`index.ts`** — Factory: `import.meta.env.DEV ? MockService : TauriService`

### Step 4: Zustand Stores

Create `src/stores/`:

- `projectStore.ts` — projects, activeProject, loading/error, actions (load, setActive, add, remove)
- `debriefStore.ts` — pendingCommits, reviewedCommits, currentDebrief, gapStats, actions
- `knowledgeStore.ts` — notes, categories, currentNote, searchResults, actions
- `settingsStore.ts` — settings, skills, actions (load, update, toggleSkill, testConnection)
- `themeStore.ts` — theme (light/dark), toggle, persist to localStorage

### Step 5: Layout & Shared UI Components

**Layout (`src/components/layout/`):**
- `Sidebar.tsx` — 56px icon sidebar with nav links (Dashboard, Debrief list, Knowledge Base, Settings), theme toggle at bottom
- `Layout.tsx` — Sidebar + React Router `<Outlet />`

**UI primitives (`src/components/ui/`):**
- `Button.tsx` (variants: primary, secondary, ghost, danger; sizes: sm, md, lg; loading state)
- `Card.tsx` (subtle border container)
- `Badge.tsx` (pending, reviewed, critical, warning, info)
- `Input.tsx`, `Textarea.tsx`, `Select.tsx`, `Toggle.tsx`
- `Spinner.tsx`, `EmptyState.tsx`

**Feature components (`src/components/features/`):**
- `CommitCard.tsx` — commit hash, message, stats, timestamp, status badge, clickable
- `StatCard.tsx` — label + value for dashboard stats
- `CollapsibleSection.tsx` — expandable section with header + content

### Step 6: Routing

Create `src/router.tsx`:
- `/` → Dashboard
- `/debrief/:commitHash` → Debrief
- `/knowledge` → Knowledge Base
- `/knowledge/:noteId` → Knowledge Base (note selected)
- `/settings` → Settings

All routes nested under `<Layout />`.

Update `src/App.tsx` to use `RouterProvider` and apply dark mode class.

### Step 7: Dashboard Page

`src/pages/Dashboard.tsx`:
- Project path indicator at top
- 3 `StatCard`s in a grid: Pending Reviews, Reviewed, Gaps Found
- Pending commits list using `CommitCard` (clicking navigates to `/debrief/:hash`)
- Reviewed commits list using `CommitCard` (dimmed opacity)
- Empty states when no commits

### Step 8: Settings Page

`src/pages/Settings.tsx` with sub-components in `src/components/features/settings/`:
- `ProjectSettings.tsx` — monitored directory, file extensions, ignored paths
- `AIProviderSettings.tsx` — endpoint URL, model, API key (masked), Test Connection button
- `SystemPromptEditor.tsx` — full-height textarea, Save + Reset to Default buttons
- `SkillManager.tsx` — skill list with toggles, detection badges, edit button
- `AnalysisSettings.tsx` — auto-analyze toggle, checkpoint mode, analysis depth
- `KnowledgeBaseSettings.tsx` — storage path, auto-generate toggle
- `AppearanceSettings.tsx` — theme toggle (light/dark), language select

### Step 9: Knowledge Base Page

`src/pages/KnowledgeBase.tsx` with sub-components in `src/components/features/knowledge/`:
- `KnowledgeTree.tsx` — folder tree with search input, "New Note" button, expandable categories
- `MarkdownRenderer.tsx` — renders markdown with syntax highlighting, converts `[[wikilinks]]` to internal links
- `NoteBreadcrumbs.tsx` — category path navigation
- `NoteEditor.tsx` — textarea editor with save/cancel

Split layout: left sidebar (260px) + right content area.

### Step 10: Debrief Page (Most Complex)

`src/pages/Debrief.tsx` with sub-components in `src/components/features/debrief/`:
- `ResizablePanel.tsx` — draggable split view (55/45 default, 30-75% range)
- `DiffViewer.tsx` — Monaco Editor in diff mode with syntax highlighting
- `DebriefPanel.tsx` — container for 4 collapsible sections
- `ArchitecturalOverview.tsx` — summary + pattern tags
- `DecisionsList.tsx` — decisions with alternatives and tradeoffs
- `GapsList.tsx` + `GapAlert.tsx` — color-coded gaps by severity/category
- `CheckpointSection.tsx` — tabbed Q1/Q2/Q3 with answer textarea, submit, evaluation display

Header bar: back button, commit info, "Save to KB" button, "Mark Reviewed" button.

### Step 11: Custom Hooks

Create `src/hooks/`:
- `useLocalStorage.ts` — persist values to localStorage (panel sizes, preferences)
- `useDebounce.ts` — debounce for search inputs
- `useTheme.ts` — wrapper around themeStore

### Step 12: Polish

- `ErrorBoundary.tsx` — catches React errors, shows friendly message
- Loading spinners on all async operations
- Empty states for all lists
- Toast notifications via `react-hot-toast` (mark reviewed, save to KB, errors)
- Verify dark/light theme works on all pages

### Step 13: Testing Setup & Unit Tests

Set up Vitest + React Testing Library + jsdom. Add test scripts to `package.json`.

**Test files live next to the code they test:** `Button.tsx` → `Button.test.tsx`, `mock.ts` → `mock.test.ts`.

#### 13a: Service Layer Tests (`src/services/__tests__/`)

These are the most critical tests — they validate that mock data conforms to the contract and that the service layer works correctly. When the real backend is built, these same tests (minus mock-specific ones) can run against `TauriService` to verify compatibility.

- **Service contract tests** — For each `I*Service` interface, test that:
  - Every method returns the correct type shape
  - Returned data has all required fields populated (no undefined where not expected)
  - IDs are unique across returned collections
  - Enum values (severity, category, status, theme, etc.) are valid
  - Timestamps are valid dates
- **Mock statefulness tests** — Test that:
  - `markReviewed(id)` moves a commit from `getPendingCommits()` to `getReviewedCommits()`
  - `saveNote()` makes the note appear in `getNotes()` and `searchNotes()`
  - `toggleSkill(id, false)` disables the skill in subsequent `getSkills()` calls
  - `updateSettings()` persists changes to `getSettings()`
  - `submitCheckpoint()` returns an evaluation and stores the response
- **Edge case tests** — Test that:
  - `getPendingCommits()` for a project with no commits returns `[]`
  - `searchNotes("")` returns all notes (or empty, depending on design choice)
  - `getDebriefByCommit("nonexistent")` throws or returns null gracefully
  - `testAIConnection()` returns both success and failure scenarios

#### 13b: Zustand Store Tests (`src/stores/__tests__/`)

Test stores in isolation by injecting mock services. Each store test verifies:

- **Initial state** is correct (empty arrays, null values, loading: false)
- **Loading actions** set `loading: true`, call the service, store results, set `loading: false`
- **Error handling** — when service throws, store captures the error message and sets `loading: false`
- **State mutations** — e.g., `markReviewed` in debriefStore removes the commit from pending and adds to reviewed
- **Theme store** — persists to localStorage, initializes from localStorage on creation

#### 13c: Component Unit Tests (`src/components/**/*.test.tsx`)

Test components render correctly with given props using React Testing Library:

**UI primitives:**
- `Button` — renders all variants, shows spinner when loading, fires onClick
- `Badge` — renders correct color/text for each variant (pending, critical, warning, info, reviewed)
- `Toggle` — renders on/off state, fires onChange
- `CollapsibleSection` — starts expanded/collapsed based on prop, toggles on click, renders children when expanded
- `Card` — renders children, applies className
- `EmptyState` — renders message and optional action button

**Feature components:**
- `CommitCard` — renders commit hash (truncated), message, file count, additions/deletions, timestamp, correct status badge, fires onClick
- `StatCard` — renders label and value
- `GapAlert` — renders correct severity color (critical=red, warning=amber, info=blue), category badge, description, explanation, suggestion
- `MarkdownRenderer` — renders headings, code blocks with syntax highlighting, converts `[[wikilinks]]` to clickable links, handles empty content
- `KnowledgeTree` — renders category folders, expands/collapses on click, shows note count per category, filters when search input changes
- `CheckpointSection` — renders tabs for each question, shows textarea, submit button, displays evaluation after submission
- `ResizablePanel` — renders left/right children, divider is draggable, respects min/max constraints (30%-75%)

#### 13d: Page Integration Tests (`src/pages/__tests__/`)

Test each page renders correctly with mock data and user interactions work end-to-end (within the frontend):

- **Dashboard** — renders stat cards with correct counts from mock data, renders pending commits list, renders reviewed commits list with dimmed style, clicking a commit card navigates to `/debrief/:hash`
- **Settings** — renders all sections, toggling theme updates the store, toggling a skill calls `toggleSkill`, "Test Connection" button shows success/error feedback
- **KnowledgeBase** — renders tree with mock categories, clicking a note shows its content in the reader, search filters the tree, "New Note" opens editor
- **Debrief** — renders diff viewer and debrief panel, all 4 sections expand/collapse, answering a checkpoint question and submitting shows evaluation, "Mark Reviewed" calls service and navigates back

#### 13e: Hook Tests (`src/hooks/__tests__/`)

- `useLocalStorage` — reads/writes localStorage, returns default when key doesn't exist, updates when value changes
- `useDebounce` — delays value updates by specified ms, cancels pending updates on unmount
- `useTheme` — returns current theme, toggleTheme switches between light/dark

### Step 14: Build Verification

- Run `pnpm test` — all tests pass
- Run `pnpm build` to verify Tauri production build succeeds
- Test the built executable launches and displays all pages correctly

---

## Dependencies

**Production:**
```
react, react-dom, react-router-dom, zustand,
@monaco-editor/react, monaco-editor,
react-markdown, remark-gfm, rehype-highlight, rehype-raw,
clsx, tailwind-merge, react-hot-toast
```

**Dev:**
```
@tauri-apps/cli, @vitejs/plugin-react, vite, typescript,
@types/react, @types/react-dom, @types/node,
tailwindcss, postcss, autoprefixer,
eslint, prettier, eslint-config-prettier, prettier-plugin-tailwindcss
```

**Testing:**
```
vitest, @testing-library/react, @testing-library/jest-dom,
@testing-library/user-event, jsdom
```

---

## Final Structure

```
src/
├── components/
│   ├── layout/          (Sidebar, Layout)
│   ├── ui/              (Button, Card, Badge, Input, Toggle, etc. + *.test.tsx)
│   ├── features/
│   │   ├── debrief/     (DiffViewer, DebriefPanel, GapAlert, Checkpoint, ResizablePanel + tests)
│   │   ├── knowledge/   (KnowledgeTree, MarkdownRenderer, NoteEditor + tests)
│   │   └── settings/    (ProjectSettings, AIProvider, SkillManager, etc. + tests)
│   ├── CommitCard.tsx, StatCard.tsx, CollapsibleSection.tsx (+ tests)
│   └── ErrorBoundary.tsx
├── hooks/               (useLocalStorage, useDebounce, useTheme + *.test.ts)
├── pages/               (Dashboard, Debrief, KnowledgeBase, Settings + *.test.tsx)
├── services/            (types.ts, mock.ts, tauri.ts, index.ts + __tests__/)
├── stores/              (project, debrief, knowledge, settings, theme + __tests__/)
├── types/               (project, commit, debrief, checkpoint, knowledge, skill, settings)
├── test/                (test setup: setup.ts, test utilities, render helpers)
├── App.tsx, main.tsx, router.tsx, index.css
```

---

## Verification

### Automated
1. `pnpm test` — all unit and component tests pass
2. `pnpm test --coverage` — coverage report shows services, stores, and components are tested
3. `pnpm type-check` — zero TypeScript errors (confirms mock data matches contracts)
4. `pnpm lint` — zero linting errors

### Manual
5. `pnpm dev` — app launches in Tauri dev mode
6. Dashboard shows mock projects, commits, and stats
7. Clicking a pending commit opens Debrief with diff + analysis
8. Monaco renders the diff with syntax highlighting
9. All 4 debrief sections expand/collapse and display data
10. Checkpoint answers can be submitted and evaluated
11. "Save to KB" adds notes visible in Knowledge Base
12. "Mark Reviewed" moves commit to reviewed list
13. Knowledge Base tree shows categories, notes render with wikilinks
14. Settings page loads/saves all configuration sections
15. Theme toggle switches light/dark across all pages
16. `pnpm build` produces a working executable

---

## Design Language (Reference)

- **Palette:** Strictly grayscale. Color only for: diff additions (green), diff deletions (red), gap severity (critical=red, warning=amber, info=blue), success (green)
- **Typography:** JetBrains Mono for code/labels/badges/nav/buttons. System sans-serif for body prose
- **Sidebar:** 56px wide, icons only, no labels
- **Cards:** Subtle borders, no heavy shadows
- **Sections:** Collapsible to manage density
