# codeGraph Plan: Code Graph page for diffAdvisor

## Context

diffAdvisor reviews commits with AI and helps the developer learn from them. codeGraph adds a second way to understand a codebase: an interactive graph where every cell is a function, connected by calls, HTTP routes and imports, with a side panel that shows the code, explains each reserved word from offline documentation and, on demand, asks the configured AI provider for a didactic explanation of the clicked term.

codeGraph ships as a page inside diffAdvisor (`/code-graph`), reusing its stack: Tauri 2, Rust services, React 19 + TypeScript + zustand, the CSS tokens in `src/index.css` and the AI layer in `services/ai.rs` (`LlmConfig::Api` for an OpenAI-compatible endpoint, or `LlmConfig::Agent` for the opencode, Claude Code and Codex CLIs).

**Visual reference:** the interactive mockup built during design (Claude Design canvas "codeGraph Mockup"). The React components delivered with this plan (`src/components/features/codegraph/`) are a port of that mockup and are the source of truth for layout, spacing and behavior. Where this document and the components disagree, the components win for visuals and this document wins for behavior.

**MVP language:** TypeScript / JavaScript (including JSX/TSX). Everything language-specific lives behind a `LanguageSupport` boundary so more languages can be added later.

---

## Goals

1. Show the structure of a project as a graph of functions grouped by file, with call, HTTP and import relationships.
2. Let the user control how much of the project is shown (entry point, depth, node cap) so large projects stay readable.
3. Make every function and every reserved word explorable without leaving the page: code, metrics, callers, callees, offline docs, AI explanation.
4. Work offline by default. Network is only used to download documentation packs and, if the user configured it, to reach the AI provider.

## Non-goals (for this plan)

- Editing code from the graph.
- Languages other than TS/JS.
- Persisting manual layout across app restarts (explicit decision: drags live only in memory).
- Debrief integration (impact view). Planned as Phase 6, specified at the end so the data model already supports it.

---

## Decisions log

| # | Topic | Decision |
|---|-------|----------|
| 1 | Expanded cell | Each cell has a chevron. Expanded shows parameters, return type, one-line doc summary and its callbacks. Several cells can be expanded at once. |
| 2 | Exploration modes | Two modes, both in MVP: **File** (depth counted in import hops from an entry file; files in scope appear with all their functions) and **Function** (depth counted in call hops from an entry function; only reached functions appear). |
| 3 | Code outside the project | Calls to packages, runtime globals and built-ins (`fetch`, `pg`, `toLocaleString`) appear as small gray **external chips** under the calling file, linked to the caller. Toggle "Externals" hides them. |
| 4 | Manual layout | Drag offsets live in the zustand store only. Re-analysis keeps offsets for node ids that still exist and lays out new nodes. A page reload or app restart discards them. |
| 5 | Navigation | Search by function name (substring, case-insensitive; Enter opens the first match, Esc clears) and a Back button with a selection history (last 30). |
| 6 | Hard cases | Callbacks and arrow functions passed as arguments become child entries of their parent cell, visible when expanded. Calls the analyzer cannot resolve appear as **unresolved chips** (`? hooks[…]()`, dashed). Recursion is drawn as a self edge. Class methods are cells; the class is a labeled group inside the file container. |
| 7 | Node.js | Not guaranteed on end-user machines. If `node` is found, the analyzer uses `typescript-language-server` for precise resolution. If not, it falls back to tree-sitter-only heuristic resolution and the footer says so. |
| 8 | Offline docs | Downloadable documentation packs managed in Settings (install, remove, size, license). Nothing is bundled in the installer. |
| 9 | AI | Reuses `services/ai.rs` and `load_llm_config`. Explanations are always about the **clicked term in its line and function**, never a whole-function review. Output language follows `appearance.debriefLanguage`. |
| 10 | Placement | Lives inside diffAdvisor, new sidebar item between Debrief and Knowledge. |
| 11 | Layers | No frontend/backend lanes. Each file gets an optional tag (`client` / `server`) from framework heuristics; files without a rule stay neutral. Layout never depends on the tag. |
| 12 | Layout engine | Built-in deterministic layered layout (no ELK dependency). ELK stays an option if crossings become a problem on real projects. |
| 13 | Contrast | Dark theme tokens were raised for low-luminosity screens (already in `main`, commit `8ba8c24`). Components only use `var(--…)` tokens, so they inherit the app palette. |

---

## User-facing behavior

### Page layout

```
┌──┬──────────────────────────────────────────────────────────────────────────┐
│  │ Header: "Code Graph", project path, stack chip, stats, last analysis    │
│S ├───────────────┬──────────────────────────────────────┬─────────────────┤
│i │ Controls      │ Toolbar: Back · Search · Externals · │ Details panel   │
│d │ - mode        │ Reorganize · zoom − % + · Fit         │ [Function|File] │
│e │ - entry       ├──────────────────────────────────────┤ header, metrics │
│b │ - depth + rec │ Graph canvas (pan, zoom, drag)        │ callers/callees │
│a │ - node cap    │                                      │ code view       │
│r │ - Analyze     │                                      │ documentation   │
│  │ - Explorer    ├──────────────────────────────────────┤ AI explanation  │
│  │               │ Legend                               │                 │
│  ├───────────────┴──────────────────────────────────────┴─────────────────┤
│  │ Footer: analyzer status (LSP / heuristic), parser, cache                │
└──┴──────────────────────────────────────────────────────────────────────────┘
```

Widths: controls 260px, details 400px (min 300), canvas takes the rest. Below ~1100px the panels wrap under the canvas (flex-wrap), as in the mockup.

### Controls panel

- **Exploration mode**: segmented `File` / `Function`. Switching mode resets depth to the recommended value of that mode. Switching to Function uses the currently selected function as entry.
- **Entry**: a select. File mode lists project files (entry defaults to the project's main page or the most imported-from file, see "Default entry"). Function mode lists functions as `name · path`.
- **Depth**: numeric input (1 to 10) plus a "Use N" button and a line "Recommended: N (reason)". See "Recommended depth".
- **Node cap**: numeric input, default 200 (setting `codegraph.maxNodes`).
- **Analyze**: runs analysis with the current parameters. Depth, entry and mode changes also re-run analysis automatically after a 300 ms debounce (cache makes this cheap).
- **Explorer**: tree of files sorted by path. Each file row shows a scope badge (File mode: `L0`, `L2`, `L4 ghost`, `out`; Function mode: `reached/total`). Clicking a file opens it in the File tab. Functions are listed under it; clicking one selects it.

### Scope rules

Every analyzed node has a distance from the entry (`level` for files in File mode, `distance` for functions in Function mode).

| Distance | Scope | Rendering |
|----------|-------|-----------|
| `<= depth` | `in` | normal |
| `depth + 1` | `ghost` | dashed border, 75% opacity, meta text "out of scope · expand" |
| `> depth + 1` or unreachable | `out` | not rendered |

Clicking a ghost cell (or a ghost file's "file" button) raises depth to that node's distance and re-runs analysis, so the graph grows only in that direction from the user's point of view.

**Node cap:** if the `in` set exceeds `maxNodes`, the analyzer keeps the nodes with the smallest distance (ties broken by fan-in descending) and sets `truncated: true`. The UI shows a warning chip in the toolbar: "Showing 200 of 431 functions. Increase the cap or reduce depth."

### Recommended depth

Computed by the analyzer and returned with the graph:

- File mode: the largest depth whose `in` set stays `<= 60%` of the node cap, clamped to `[1, 5]`. Reason text: `"<files> files, <functions> functions"`.
- Function mode: the median length of call chains from the entry, clamped to `[2, 6]`. Reason text: `"median call chain of <n>"`.

### Default entry

File mode: in Next.js projects, the first `app/**/page.tsx` by path; otherwise the file with the highest number of outgoing imports among files that are imported by nobody. Function mode: the selected function, or the default export of the default entry file.

### Graph canvas

**File container**: rounded box (radius 10, `--card-bg`, 1px `--border`) with a header row: tag color dot, relative path (ellipsis), scope badge, and a `file` button that opens the File tab. Functions are laid out in a grid of 2 columns inside the container (cell 170x58, 16px gap). If any function in a row is expanded, that row is 168px tall. If the file has visible external or unresolved calls and Externals is on, a 38px strip of chips is added at the bottom.

**Function cell** (collapsed):
- 3px left accent with the file tag color (`--info` for client, `--warning` for server, `--text-tertiary` for untagged).
- Name (JetBrains Mono 13/600, ellipsis).
- Meta line: `in <fanIn> · out <fanOut> · <loc> loc`, plus ` · +<n> cb` when it has callbacks.
- Chevron button (22x22) at top right toggles expanded.

**Function cell** (expanded) adds, below a divider: one line per parameter (or "no parameters"), `→ <return type>`, the one-line doc summary (first sentence of the JSDoc/TSDoc, or empty), and one line per callback (`↳ orders.map((o) => …)`).

**States:**
- Selected: 1px `--text` border plus outer ring.
- Neighbors of the selection (callers and callees): full opacity. Others: 85%.
- Search active: matches get a 2px `--warning` ring, non-matches drop to 35%.

**Edges** (SVG, cubic bezier):

| Kind | Style |
|------|-------|
| `call` | solid, `--text-tertiary`-ish gray (`#8a8a8a` in the mockup), 1.3px |
| `http` | dashed `6 5`, purple `#b98cff`, with an `HTTP` pill at the midpoint |
| `ghost` (either end ghost) | dashed `3 4`, darker gray |
| touching selection | `--text`, 1.8px |
| external / unresolved chip | thin gray from the caller's bottom center to the chip; dashed `3 3` when unresolved |

Edge anchors: if the target is to the right, right-middle of source to left-middle of target; to the left, the mirror; same column across files, a left-side curve; overlapping columns, bottom to top. Anchor y for side anchors is the collapsed row center (top + 29) so expanding a cell does not move its edges.

**Interactions:**
- Drag: pointer down on a file container or on any of its cells starts a drag of the whole file after 4px of movement. A drag suppresses the click that follows it.
- Pan: pointer down on empty canvas pans the scroll container.
- Zoom: Ctrl/Cmd + wheel, toolbar `−`/`+` (x1.15), `Fit` (fit width, max 120%). Range 40% to 200%.
- Reorganize: clears all drag offsets.

### Layout algorithm (built-in)

Deterministic, runs on the frontend after each analysis or when cells expand:

1. **Columns**: File mode uses the file level. Function mode uses the minimum distance among the file's visible functions. Columns are 424px apart (380 container + 44 gap), starting at x=40.
2. **Order inside a column**: barycenter of the y positions of the files that point to it in the previous column (stable sort, ties by path). The first column is ordered by path.
3. **Rows**: files stacked from y=50 with 46px gaps; container height from its grid rows and chip strip.
4. **Functions inside a file**: source order, 2 per row.
5. **Drag offsets** are added last, keyed by file id.

The layout is a pure function `layoutGraph(graph, expanded, showExternals, offsets) → Layout` in `layout.ts`, unit-tested.

### Details panel

Tabs: **Function** and **Full file**.

**Function tab**: name (18/600) and tag badge; `path:line` link that opens the Full file tab; signature box; four metric tiles (lines, complexity, fan-in, fan-out); "called by" and "calls" chips (clicking navigates and expands depth when needed; HTTP chips are bordered purple; external and unresolved calls are listed as non-clickable chips).

**Full file tab**: path, tag badge, summary `<lines> lines · <n> functions · <n> imports`, function chips, the whole file with the selected function's lines highlighted (`--info-bg` background, 2px `--info` left mark).

**Code view** (both tabs): line numbers, syntax colors from tree-sitter highlight spans (see `get_source`), reserved words underlined with a dotted line and clickable. Only tokens of kind `keyword` (and TS primitive types: `string`, `number`, `boolean`, `void`, `never`, `unknown`, `any`) are clickable. Clicking selects the term and closes any open AI explanation.

**Documentation**: for the selected term, shows the entry from the installed doc pack: term, category, explanation, example, source line. If no pack is installed: "Install the TypeScript documentation pack in Settings to see explanations offline" with a button that navigates to `/settings#docs`. For non-keyword identifiers (future), LSP hover is used.

**AI explanation**: visible only when a term is selected. Button "Explain `<term>` with AI". The result has four parts, always in this order:

1. **In one sentence** (what the term does here).
2. **Simple use case** (a tiny code example with comments showing input and output).
3. **Step by step** (2 to 4 short steps).
4. **Watch out** (one common mistake or caveat).

Footer line: "Context sent: the term, its line and the function `<name>`." While running: spinner and a Cancel button (calls `cancel_ai_run`). Errors show inline with a Retry button. Results are cached in memory per `(functionId, term, lineText)`.

### Re-analysis

- Manual: Analyze button.
- Automatic: when the page is mounted and the `commit_detected` event fires (already emitted by `services/watcher.rs`), re-run analysis with the same parameters. The cache makes unchanged files free.
- Drag offsets are kept for ids that still exist (decision 4). Selection is kept if its id still exists, otherwise falls back to the entry.
- Footer shows "analyzed <relative time>".

---

## Data model

Ids are stable and human-readable so they survive re-analysis:

- File id: path relative to the project root, forward slashes (`app/dashboard/page.tsx`).
- Function id: `<fileId>#<qualifiedName>` where qualifiedName is `name`, `Class.method`, or `parent/callbackKind@line` for callbacks (`components/OrderTable.tsx#OrderTable/map@5`).

### TypeScript (`src/types/codegraph.ts`)

```ts
export type ExploreMode = 'file' | 'function'
export type Scope = 'in' | 'ghost'
export type FileTag = 'client' | 'server' | null
export type FunctionKind = 'function' | 'method' | 'arrow' | 'component' | 'callback'
export type EdgeKind = 'call' | 'http' | 'render'
export type Resolution = 'lsp' | 'heuristic'
export type AnalyzerMode = 'lsp' | 'heuristic'

export interface GraphFile {
  id: string
  path: string
  tag: FileTag
  level: number | null        // import distance from entry file (File mode), null if unreachable
  scope: Scope
  lineCount: number
  imports: string[]           // file ids imported by this file
  classes: { name: string; functionIds: string[] }[]
}

export interface GraphFunction {
  id: string
  fileId: string
  name: string
  kind: FunctionKind
  parentId: string | null     // set for callbacks
  startLine: number           // 1-based, inclusive
  endLine: number
  signature: string
  params: string[]
  returns: string | null
  docSummary: string | null
  loc: number
  complexity: number
  fanIn: number
  fanOut: number
  callbackIds: string[]
  distance: number | null     // call distance from entry function (Function mode)
  scope: Scope
}

export interface GraphEdge {
  from: string                // function id
  to: string                  // function id (self edge allowed for recursion)
  kind: EdgeKind
  resolution: Resolution
  line: number                // call site line in `from`'s file
}

export interface ExternalCall {
  from: string                // function id
  label: string               // "fetch", "pool.connect", "hooks[…]?.()"
  pkg: string | null          // "web", "pg", "js"; null when unresolved
  unresolved: boolean
  line: number
}

export interface CodeGraph {
  projectId: string
  mode: ExploreMode
  entry: string               // file id or function id
  depth: number
  recommendedDepth: number
  recommendedReason: string
  maxNodes: number
  truncated: boolean
  totalFunctions: number      // before cap and scope filtering
  allFiles: { id: string; path: string; tag: FileTag; functionNames: { id: string; name: string }[] }[]  // every analyzable file, for the entry select and the Explorer
  files: GraphFile[]
  functions: GraphFunction[]
  edges: GraphEdge[]
  externals: ExternalCall[]
  analyzer: { mode: AnalyzerMode; nodeVersion: string | null; lspVersion: string | null; parser: string }
  cache: { files: number; hits: number }
  analyzedAt: string          // ISO timestamp
}

export interface SourceToken { line: number; start: number; end: number; kind: TokenKind }
export type TokenKind = 'keyword' | 'type' | 'string' | 'number' | 'comment' | 'function' | 'punctuation' | 'plain'
export interface SourceFile { fileId: string; text: string; tokens: SourceToken[] }

export interface KeywordDoc { term: string; category: string; text: string; example: string; source: string }

export interface TermExplanation {
  term: string
  where: string               // "DashboardPage, line 9"
  summary: string
  example: string
  steps: string[]
  attention: string
}

export interface DocPack {
  id: string                  // "typescript"
  name: string
  version: string
  sizeBytes: number
  license: string
  installed: boolean
  installedVersion: string | null
}

export interface CodeGraphStatus {
  nodeVersion: string | null
  lsp: 'ready' | 'starting' | 'missing' | 'error'
  lspPath: string | null
  analyzerMode: AnalyzerMode
}
```

Only `in` and `ghost` nodes are sent. Edges are sent only when both ends are sent and at least one is `in`. Externals only for `in` functions.

Rust DTOs mirror these with `#[serde(rename_all = "camelCase")]` and `id: String` everywhere, as in the rest of the app (see phase4 decisions).

---

## Backend

### New modules

```
src-tauri/src/services/codegraph/
  mod.rs            pub fn analyze(...), status(), source()
  model.rs          internal structs (ProjectIndex, FileIndex, FnDef, CallSite)
  discover.rs       file discovery (gitignore, project.ignoredPaths, project.fileExtensions)
  parse.rs          tree-sitter: functions, classes, callbacks, imports, call sites, directives, highlight spans
  resolve.rs        import resolution (relative, tsconfig paths, index files) + call resolution
  lsp.rs            typescript-language-server client (stdio JSON-RPC)
  routes.rs         framework heuristics: HTTP edges and client/server tags
  metrics.rs        loc, cyclomatic complexity, fan-in/out
  scope.rs          BFS, ghost ring, node cap, recommended depth
  cache.rs          per-file parse cache keyed by (path, mtime, size, content hash)
src-tauri/src/services/docpacks.rs
src-tauri/src/commands/codegraph.rs
src-tauri/src/commands/docpacks.rs
```

Register commands in `main.rs` and modules in `commands/mod.rs` and `services/mod.rs`. Add to `AppState`:

```rust
pub codegraph: tokio::sync::Mutex<crate::services::codegraph::Engine>,
```

`Engine` owns the parse cache (per project id) and the LSP client handle, so both survive between calls and are dropped when the active project changes.

### Dependencies (Cargo.toml)

```toml
tree-sitter = "0.25"
tree-sitter-typescript = "0.23"
lsp-types = "0.97"
ignore = "0.4"            # gitignore-aware walking (same crate ripgrep uses)
blake3 = "1"              # content hash for cache keys
tokio = { version = "1", features = ["rt-multi-thread", "macros", "process", "io-util", "sync", "time"] }
```

Check the latest compatible versions when adding; `tree-sitter` and its grammars must agree on ABI.

### Analysis pipeline

`analyze(project_path, params) -> CodeGraph`, run on a blocking task with progress events `codegraph_progress { stage, done, total }`:

1. **Discover**: walk with `ignore::WalkBuilder` honoring `.gitignore`, `project.ignoredPaths` and `project.fileExtensions` (default `ts,tsx,js,jsx,mjs,cjs`). Skip `node_modules`, `.next`, `dist`, `build` always.
2. **Parse** (cached): tree-sitter TSX grammar for `.tsx/.jsx`, TypeScript grammar otherwise. Extract:
   - function declarations, exported arrow/function expressions bound to `const`, class declarations and methods, object-literal methods;
   - callbacks: arrow/function expressions passed directly as call arguments (`.map`, `.filter`, `.then`, event handlers);
   - imports (static `import`, `export … from`, dynamic `import('…')` with a literal);
   - call sites: `call_expression` and `new_expression` with callee text and position, attributed to the innermost enclosing function (callbacks attribute to themselves, and the parent gets the callback as child);
   - JSX elements whose tag starts with an uppercase letter as `render` call sites;
   - directives `'use client'` / `'use server'`;
   - JSDoc/TSDoc block right above a function, first sentence as `docSummary`;
   - highlight spans for `get_source` (tree-sitter `highlights.scm` from the grammar crate).
3. **Resolve imports**: relative paths, `tsconfig.json` `compilerOptions.paths` + `baseUrl` (follow `extends`), extension and `index.*` probing. Unresolved bare specifiers are packages (used to label externals).
4. **Resolve calls**:
   - **LSP mode**: for each call site, `textDocument/definition` at the callee identifier position. If the location is inside the project and inside a known function range, create an edge (`resolution: lsp`). If it is inside `node_modules` or a lib `.d.ts`, create an external with `pkg` from the path (`node_modules/pg/...` → `pg`, `lib.dom.d.ts` → `web`, `lib.es*.d.ts` → `js`). If there is no result, create an unresolved external. Batch requests with a concurrency limit of 16.
   - **Heuristic mode**: identifier callees are matched against same-file functions, then named imports (following re-exports one level), then default imports. `obj.method()` where `obj` is a namespace import resolves through the module. Anything else: global known names (`fetch`, `URL`, `Response`, `setTimeout`, `console`…) become externals with `pkg: web|js`; computed or unknown member calls become unresolved.
5. **HTTP edges** (`routes.rs`, Next.js App Router in MVP): collect route handlers from `app/**/route.{ts,js}` exporting `GET|POST|PUT|PATCH|DELETE`, mapping the folder path to a URL pattern (`[id]` → `:param`, route groups `(x)` removed). For call sites to `fetch`, `axios.<method>`, `ky` or a project wrapper that eventually calls `fetch` with a string or template literal whose static prefix starts with `/`, match the literal against the patterns and the HTTP method (`fetch` default `GET`, `{ method: 'POST' }` when literal). The edge goes from the function containing the literal to the handler (`kind: http`). In the sample project, the literal lives in `fetchOrders` and is passed to `request`; the edge is drawn from the function that **contains the literal** and also from the wrapper when the literal is passed straight through a parameter used as the `fetch` argument (one level).
6. **Tags**: `'use client'` → `client`; `'use server'`, `route.*`, `app/**/page|layout.*` without `'use client'`, files importing server-only modules (`server-only`, `pg`, `fs`, `@prisma/client`) → `server`; otherwise `null`.
7. **Metrics**: `loc` = endLine − startLine + 1; cyclomatic complexity = 1 + count of `if`, `for*`, `while`, `case`, `catch`, `&&`, `||`, `??`, ternary inside the function (not descending into callbacks); fan-in/out from edges (externals do not count). Calls made inside a callback count toward the fan-out of the top-level function that contains it, and the graph draws those edges from the parent cell.
8. **Scope** (`scope.rs`): File mode BFS over file import edges plus HTTP edges (a fetch to a route counts as a hop); Function mode BFS over call + render + http edges. Mark `in`/`ghost`, drop the rest, apply node cap, compute recommended depth.
9. **Emit** `CodeGraph`.

Performance targets: warm cache, 200 nodes, heuristic mode under 500 ms; LSP mode under 2 s warm and under 10 s cold. Parse files in parallel with `rayon` only if needed (not a dependency in MVP).

### LSP client (`lsp.rs`)

- Detection order for the server binary: `<project>/node_modules/.bin/typescript-language-server`, then `PATH`, then `<data_dir>/diffAdvisor/lsp/node_modules/.bin/typescript-language-server`.
- Requires `node --version` to succeed. If not, status `missing` and heuristic mode.
- Spawn `typescript-language-server --stdio` with `rootUri` = project path, `initializationOptions.tsserver.path` pointing to the project's `node_modules/typescript/lib/tsserver.js` when present.
- Minimal JSON-RPC over stdio with `Content-Length` framing on top of `tokio::process`. Requests used: `initialize`, `initialized`, `textDocument/didOpen` (only files being resolved), `textDocument/definition`, `textDocument/hover`, `shutdown`, `exit`.
- Lifecycle: started lazily on the first LSP-mode analysis, shut down after 5 minutes idle, on project switch and on app exit. Startup timeout 20 s; on any failure fall back to heuristic for that run and set status `error` with the message.
- "Install language server" in Settings runs `npm install --prefix <data_dir>/diffAdvisor/lsp typescript-language-server typescript` (only enabled when `node`/`npm` exist), streaming output to the UI.

### Commands (`commands/codegraph.rs`)

```rust
#[tauri::command] async fn codegraph_status(state) -> Result<CodeGraphStatusDto, String>
#[tauri::command] async fn analyze_graph(state, handle, project_id: i64, params: AnalyzeParamsDto) -> Result<CodeGraphDto, String>
#[tauri::command] async fn get_source(state, project_id: i64, file_id: String) -> Result<SourceFileDto, String>
#[tauri::command] async fn get_keyword_doc(language: String, term: String) -> Result<Option<KeywordDocDto>, String>
#[tauri::command] async fn explain_term(state, project_id: i64, request: ExplainTermRequestDto) -> Result<TermExplanationDto, String>
#[tauri::command] async fn install_language_server(handle) -> Result<(), String>
```

`AnalyzeParamsDto { mode, entry: Option<String>, depth: Option<u32>, max_nodes: Option<u32> }`. When `entry` or `depth` is `None` the analyzer uses the default entry and the recommended depth.

`get_source` must reject `file_id` values that escape the project root (`..`, absolute paths) and must only serve files the discovery step would include.

### AI (`services/ai.rs`)

Add, next to `evaluate_checkpoint`:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TermExplanationResponse {
    pub summary: String,
    pub example: String,
    pub steps: Vec<String>,
    pub attention: String,
}

pub async fn explain_term(
    config: &LlmConfig,
    language: &str,          // "English" | "Portuguese"
    term: &str,
    line_text: &str,
    function_source: &str,
    file_path: &str,
) -> Result<TermExplanationResponse, AiError>
```

It calls the private `call_chat_completion` with temperature 0.3 and a 60 s timeout, then `parse_json_response`. System prompt:

```
You are a patient programming teacher helping a junior developer read real code.
Explain ONE term exactly as it is used in the given line and function. Be didactic and concrete.
Write in {language}. Respond ONLY with valid JSON:
{"summary": "<one sentence, what the term does here>",
 "example": "<a tiny standalone code example, max 10 lines, with comments showing input and output>",
 "steps": ["<2 to 4 short steps explaining how it works>"],
 "attention": "<one common mistake or caveat, one or two sentences>"}
Never review or criticize the rest of the function. Do not use markdown inside the JSON strings except newlines in "example".
```

User message: `Term: {term}\nFile: {file_path}\nLine: {line_text}\n\nFunction:\n{function_source}`.

The command resolves `language` from `appearance.debriefLanguage` (`auto` → `Portuguese` if the OS locale starts with `pt`, else `English`), loads the config with `llm::load_llm_config(&state, None, vec![], Duration::from_secs(120))` (with an agent CLI provider it runs in its scratch dir: the prompt already carries the function source, so it does not need to read the repo; the model and reasoning level come from the provider's settings, as for every other AI call), and maps `AiError::Cancelled` to a distinct error string so the UI shows "Cancelled" instead of an error.

### Documentation packs (`services/docpacks.rs`, `commands/docpacks.rs`)

- Manifest URL setting `codegraph.docPacksManifestUrl` (default: a JSON file in the diffAdvisor GitHub repo, `docpacks/manifest.json`, served raw). Manifest entries: `{ id, name, version, sizeBytes, license, url, sha256, language }`.
- Packs install into `<data_dir>/diffAdvisor/docs/<id>/` and contain `pack.json`:

```json
{
  "id": "typescript",
  "language": "typescript",
  "version": "2026.10",
  "license": "…",
  "source": "Built from … by scripts/build-docpack.mjs",
  "entries": {
    "await": { "category": "reserved word · async", "text": "…", "example": "const data = await fetch(url);" }
  }
}
```

- Commands: `list_doc_packs`, `install_doc_pack(id)` (download, verify sha256, unpack, emit `docpack_progress`), `remove_doc_pack(id)`. `get_keyword_doc` reads from installed packs, in-memory cached.
- Pack content is authored (or generated by a build script from upstream references) **with the license of each upstream source recorded in the pack and shown in Settings**. Keep the first pack hand-written in our own words for the ~40 TS/JS reserved words and primitive types, which avoids redistributing upstream text.

### Settings

Add a `codegraph` section to `AppSettings` (flattened keys `codegraph.*` like the others):

```ts
export interface CodeGraphSettings {
  maxNodes: number              // default 200
  showExternals: boolean        // default true
  autoReanalyzeOnCommit: boolean // default true
  docPacksManifestUrl: string
}
```

New Settings section "Code Graph" (component `CodeGraphSettings.tsx`, same `SettingsSection` pattern): language server status and install button, default node cap, externals default, auto re-analyze toggle, and the doc packs list (name, version, size, license, Install/Remove, progress bar). Anchor id `docs` for deep links.

---

## Frontend

### Files

```
src/types/codegraph.ts
src/services/codegraph/types.ts     ICodeGraphService
src/services/codegraph/tauri.ts     TauriCodeGraphService (invoke)
src/services/codegraph/mock.ts      MockCodeGraphService (sample project from the mockup)
src/services/codegraph/index.ts     codeGraphService (mock or tauri, using IS_MOCK_SERVICES)
src/stores/codegraphStore.ts
src/pages/CodeGraph.tsx
src/components/features/codegraph/
  layout.ts            pure layout + edge path functions
  ControlsPanel.tsx
  GraphToolbar.tsx
  GraphCanvas.tsx      board, pan, zoom, drag
  FileContainer.tsx
  FunctionCell.tsx
  GraphEdges.tsx
  GraphLegend.tsx
  DetailsPanel.tsx
  CodeView.tsx
  KeywordDocCard.tsx
  TermExplanationCard.tsx
  StatusFooter.tsx
  icons.tsx
```

Edits to existing files (small, listed in `docs/plans/codegraph-integration.md`): `router.tsx` (route) and `Sidebar.tsx` (nav item). Shared inline styles live in `components/features/codegraph/styles.ts`.

The service lives in its own folder so `services/index.ts`, `services/types.ts`, `tauri.ts` and `mock.ts` stay untouched. It reads `IS_MOCK_SERVICES` from `services/index.ts`, so the page works in plain `pnpm dev` with the sample project from the mockup and in tests.

### Store (`codegraphStore.ts`)

State: `graph`, `status`, `params { mode, entry, depthText, depth, maxNodes }`, `selectedId`, `history`, `panelTab`, `fileTabId`, `expanded: Record<id, boolean>`, `offsets: Record<fileId, {dx, dy}>`, `zoom`, `query`, `showExternals`, `term`, `sources: Record<fileId, SourceFile>`, `keywordDocs`, `explanations: Record<key, TermExplanation>`, `explainState`, `loading`, `error`.

Not persisted (no `persist` middleware), by design.

Actions: `loadStatus`, `analyze` (debounced variant `requestAnalyze`), `setMode`, `setEntry`, `setDepthText`, `useRecommendedDepth`, `select(id, {pushHistory, expandScope})`, `back`, `openFile(fileId)`, `setPanelTab`, `toggleExpanded`, `moveFile`, `resetOffsets`, `setZoom`, `setQuery`, `toggleExternals`, `selectTerm`, `explainTerm`, `cancelExplain`.

### Visual tokens

Components use only `var(--…)` tokens plus these graph-specific constants in `layout.ts`:

| Constant | Value | Use |
|----------|-------|-----|
| `HTTP_EDGE` | `#b98cff` | HTTP edges and pill |
| `CALL_EDGE` | `#8a8a8a` | call edges |
| `GHOST_EDGE` | `#626262` | ghost and external edges |
| Syntax colors | keyword `#ff7ab2`, string `#9ece6a`, number `#ff9e64`, type `#e0af68`, function `#7dcfff`, punctuation `#b0b0b0` | code view |

Light theme: syntax colors switch to darker variants (`#c0266d`, `#3f7d1f`, `#b4541a`, `#8a5a00`, `#0b6e99`, `#555`) via a `useThemeStore` check in `CodeView`.

---

## Phases

Each phase leaves the app working.

### Phase 1: UI on mock data
Types, mock service with the sample project, store, page, all components, route and sidebar item. Vitest for `layout.ts` (positions, heights with expanded cells, edge anchors) and the store (history, scope expansion on ghost click, offsets kept across re-analysis).
**Done when:** `pnpm dev` shows the page identical to the mockup, all interactions work on mock data, tests pass.

### Phase 2: Analyzer, heuristic mode
`discover`, `parse`, `resolve` (heuristic), `metrics`, `scope`, `cache`; commands `analyze_graph`, `get_source`, `codegraph_status` (always heuristic). Rust tests against `src-tauri/tests/fixtures/codegraph/shop-dashboard/` (the mockup's sample project as real files) asserting the exact function set, edges, externals, unresolved call, callbacks and complexity values.
**Done when:** the real page analyzes the fixture and a real project of the user's choice.

### Phase 3: LSP mode
`lsp.rs`, detection, lifecycle, definition-based resolution, `install_language_server`, footer status. Tests: an ignored integration test that runs only when `node` is available.

### Phase 4: Docs and AI
Doc packs (service, commands, Settings UI, first hand-written TS pack), `get_keyword_doc`, `explain_term` in `ai.rs`, explanation UI with cancel and cache.

### Phase 5: Framework heuristics and auto refresh
`routes.rs` (HTTP edges, tags), `commit_detected` auto re-analysis, recommended depth tuning on real projects.

### Phase 6: Debrief integration (later)
Given a commit, mark functions whose ranges intersect the diff hunks (`changed`), plus their callers up to N hops (`impacted`). Debrief gets a "View in graph" action; the graph gets a "Commit" filter. The data model already has stable ids and line ranges for this.

---

## Open questions

1. Hosting of `docpacks/manifest.json`: GitHub raw from this repo is the simplest; confirm.
2. Windows paths: ids always use `/`; confirm the discovery step normalizes before hashing.
3. Very large files (> 5k lines): skip with a warning chip, or parse anyway? Proposal: parse, but cap highlight spans sent to the UI to the visible function in Function tab.
