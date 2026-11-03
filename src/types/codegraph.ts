// Code Graph data model. Mirrors the Rust DTOs in src-tauri/src/commands/codegraph.rs.
// See docs/plans/codegraph.md, section "Data model".

export type ExploreMode = 'file' | 'function'
export type Scope = 'in' | 'ghost'
export type FileTag = 'client' | 'server' | null
export type FunctionKind = 'function' | 'method' | 'arrow' | 'component' | 'callback'
export type EdgeKind = 'call' | 'http' | 'render'
export type Resolution = 'lsp' | 'heuristic'
export type AnalyzerMode = 'lsp' | 'heuristic'

export interface GraphFile {
  /** Path relative to the project root, forward slashes. Stable across analyses. */
  id: string
  path: string
  tag: FileTag
  /** Import distance from the entry file (File mode). Null when unreachable or in Function mode. */
  level: number | null
  scope: Scope
  lineCount: number
  /** File ids imported by this file. */
  imports: string[]
  classes: { name: string; functionIds: string[] }[]
}

export interface GraphFunction {
  /** `<fileId>#<qualifiedName>`. Stable across analyses. */
  id: string
  fileId: string
  name: string
  kind: FunctionKind
  /** Set for callbacks: the function the callback was written in. */
  parentId: string | null
  /** 1-based, inclusive. */
  startLine: number
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
  /** Call distance from the entry function (Function mode). Null in File mode. */
  distance: number | null
  scope: Scope
}

export interface GraphEdge {
  from: string
  to: string
  kind: EdgeKind
  resolution: Resolution
  /** Call site line in the file of `from`. */
  line: number
}

export interface ExternalCall {
  from: string
  /** "fetch", "pool.connect", "hooks[…]?.()" */
  label: string
  /** "web", "js", "pg"... Null when unresolved. */
  pkg: string | null
  unresolved: boolean
  line: number
}

export interface CodeGraph {
  projectId: string
  mode: ExploreMode
  /** File id (File mode) or function id (Function mode). */
  entry: string
  depth: number
  recommendedDepth: number
  recommendedReason: string
  maxNodes: number
  truncated: boolean
  /** Functions found before scope filtering and the node cap. */
  totalFunctions: number
  /** Every analyzable file in the project, for the entry select and the explorer. */
  allFiles: { id: string; path: string; tag: FileTag; functionNames: { id: string; name: string }[] }[]
  files: GraphFile[]
  functions: GraphFunction[]
  edges: GraphEdge[]
  externals: ExternalCall[]
  analyzer: { mode: AnalyzerMode; nodeVersion: string | null; lspVersion: string | null; parser: string }
  cache: { files: number; hits: number }
  /** ISO timestamp. */
  analyzedAt: string
}

export interface AnalyzeParams {
  mode: ExploreMode
  /** Null: analyzer picks the default entry. */
  entry: string | null
  /** Null: analyzer uses the recommended depth. */
  depth: number | null
  maxNodes: number | null
}

export type TokenKind =
  | 'keyword'
  | 'type'
  | 'string'
  | 'number'
  | 'comment'
  | 'function'
  | 'punctuation'
  | 'plain'

export interface SourceToken {
  /** 1-based line. */
  line: number
  /** 0-based column, end exclusive. */
  start: number
  end: number
  kind: TokenKind
}

export interface SourceFile {
  fileId: string
  text: string
  tokens: SourceToken[]
}

export interface KeywordDoc {
  term: string
  category: string
  text: string
  example: string
  source: string
}

export interface ExplainTermRequest {
  term: string
  fileId: string
  line: number
  functionId: string
}

export interface TermExplanation {
  term: string
  /** "DashboardPage, line 9" */
  where: string
  summary: string
  example: string
  steps: string[]
  attention: string
}

export interface CodeGraphStatus {
  nodeVersion: string | null
  lsp: 'ready' | 'starting' | 'missing' | 'error'
  lspPath: string | null
  analyzerMode: AnalyzerMode
}
