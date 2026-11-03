// Mock Code Graph service. Analyzes a small hand-written Next.js project (the same sample used
// in the design mockup) entirely in the browser, so the page works in `pnpm dev` and in tests.
// The scope rules here mirror docs/plans/codegraph.md ("Scope rules", "Recommended depth").

import type {
  AnalyzeParams,
  CodeGraph,
  CodeGraphStatus,
  EdgeKind,
  ExplainTermRequest,
  ExternalCall,
  FileTag,
  GraphEdge,
  GraphFile,
  GraphFunction,
  KeywordDoc,
  Scope,
  SourceFile,
  SourceToken,
  TermExplanation,
  TokenKind,
} from '@/types/codegraph.ts'
import type { ICodeGraphService } from './types.ts'

// ── Sample project ──

interface SampleCall {
  to: string // "<path>#<name>"
  kind: EdgeKind
  /** 0-based line offset inside the function body. */
  at: number
  /** Name of the callback (in the same function) that contains the call, if any. */
  inCallback?: string
}

interface SampleExternal {
  label: string
  pkg: string | null
  at: number
}

interface SampleFn {
  name: string
  params: string[]
  returns: string
  doc: string
  complexity: number
  signature: string
  code: string[]
  calls: SampleCall[]
  externals: SampleExternal[]
  /** Callbacks written inside this function: name (e.g. "map") and line offset. */
  callbacks: { name: string; label: string; at: number }[]
}

interface SampleFile {
  path: string
  tag: FileTag
  imports: string[]
  head: string[]
  fns: SampleFn[]
}

const PAGE = 'app/dashboard/page.tsx'
const TABLE = 'components/OrderTable.tsx'
const API = 'lib/api-client.ts'
const ROUTE = 'app/api/orders/route.ts'
const SVC = 'services/order-service.ts'
const DB = 'lib/db.ts'

const SAMPLE: SampleFile[] = [
  {
    path: PAGE,
    tag: 'server',
    imports: [API, TABLE],
    head: ["import { fetchOrders } from '@/lib/api-client';", "import { OrderTable } from '@/components/OrderTable';"],
    fns: [
      {
        name: 'DashboardPage',
        params: [],
        returns: 'Promise<JSX.Element>',
        doc: 'Dashboard page: open orders and their total.',
        complexity: 1,
        signature: 'export default async function DashboardPage(): Promise<JSX.Element>',
        code: [
          'export default async function DashboardPage() {',
          "  const orders = await fetchOrders({ status: 'open' });",
          '  const total = formatTotal(orders);',
          '  return (',
          '    <main>',
          '      <h1>Open orders: {total}</h1>',
          '      <OrderTable orders={orders} />',
          '    </main>',
          '  );',
          '}',
        ],
        calls: [
          { to: `${API}#fetchOrders`, kind: 'call', at: 1 },
          { to: `${PAGE}#formatTotal`, kind: 'call', at: 2 },
          { to: `${TABLE}#OrderTable`, kind: 'render', at: 6 },
        ],
        externals: [],
        callbacks: [],
      },
      {
        name: 'formatTotal',
        params: ['orders: Order[]'],
        returns: 'string',
        doc: 'Sums the amounts and formats them as BRL.',
        complexity: 2,
        signature: 'function formatTotal(orders: Order[]): string',
        code: [
          'function formatTotal(orders: Order[]): string {',
          '  let sum = 0;',
          '  for (const o of orders) sum += o.amount;',
          "  return sum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });",
          '}',
        ],
        calls: [],
        externals: [{ label: 'toLocaleString', pkg: 'js', at: 3 }],
        callbacks: [],
      },
    ],
  },
  {
    path: TABLE,
    tag: 'client',
    imports: [],
    head: ["'use client';", "import type { Order, Status } from '@/lib/types';", '', 'type Props = { orders: Order[] };'],
    fns: [
      {
        name: 'OrderTable',
        params: ['{ orders }: Props'],
        returns: 'JSX.Element',
        doc: 'Orders table, or a notice when the list is empty.',
        complexity: 2,
        signature: 'export function OrderTable({ orders }: Props): JSX.Element',
        code: [
          'export function OrderTable({ orders }: Props) {',
          '  if (orders.length === 0) return <p>No orders</p>;',
          '  return (',
          '    <table>',
          '      {orders.map((o) => (',
          '        <tr key={o.id}><td>{o.id}</td><td><StatusBadge status={o.status} /></td></tr>',
          '      ))}',
          '    </table>',
          '  );',
          '}',
        ],
        calls: [{ to: `${TABLE}#StatusBadge`, kind: 'render', at: 5, inCallback: 'map' }],
        externals: [],
        callbacks: [{ name: 'map', label: 'orders.map((o) => …)', at: 4 }],
      },
      {
        name: 'StatusBadge',
        params: ['{ status }: { status: Status }'],
        returns: 'JSX.Element',
        doc: 'Colored badge for the order status.',
        complexity: 2,
        signature: 'function StatusBadge({ status }: { status: Status }): JSX.Element',
        code: [
          'function StatusBadge({ status }: { status: Status }) {',
          "  const tone = status === 'open' ? 'blue' : 'gray';",
          '  return <span className={tone}>{status}</span>;',
          '}',
        ],
        calls: [],
        externals: [],
        callbacks: [],
      },
    ],
  },
  {
    path: API,
    tag: 'client',
    imports: [],
    head: ["import type { Filters, Order } from '@/lib/types';"],
    fns: [
      {
        name: 'fetchOrders',
        params: ['filters: Filters'],
        returns: 'Promise<Order[]>',
        doc: "Fetches orders from the project's own API.",
        complexity: 1,
        signature: 'export async function fetchOrders(filters: Filters): Promise<Order[]>',
        code: [
          'export async function fetchOrders(filters: Filters): Promise<Order[]> {',
          '  const qs = new URLSearchParams(filters).toString();',
          '  return request<Order[]>(`/api/orders?${qs}`);',
          '}',
        ],
        calls: [{ to: `${API}#request`, kind: 'call', at: 2 }],
        externals: [{ label: 'URLSearchParams', pkg: 'web', at: 1 }],
        callbacks: [],
      },
      {
        name: 'request',
        params: ['url: string'],
        returns: 'Promise<T>',
        doc: 'Generic GET that checks the response status.',
        complexity: 2,
        signature: 'async function request<T>(url: string): Promise<T>',
        code: [
          'async function request<T>(url: string): Promise<T> {',
          "  const res = await fetch(url, { cache: 'no-store' });",
          '  if (!res.ok) throw new Error(`HTTP ${res.status}`);',
          '  return res.json() as Promise<T>;',
          '}',
        ],
        calls: [{ to: `${ROUTE}#GET`, kind: 'http', at: 1 }],
        externals: [{ label: 'fetch', pkg: 'web', at: 1 }],
        callbacks: [],
      },
    ],
  },
  {
    path: ROUTE,
    tag: 'server',
    imports: [SVC],
    head: ["import { listOrders } from '@/services/order-service';", "import type { Filters } from '@/lib/types';"],
    fns: [
      {
        name: 'GET',
        params: ['req: Request'],
        returns: 'Promise<Response>',
        doc: 'HTTP handler for /api/orders.',
        complexity: 1,
        signature: 'export async function GET(req: Request): Promise<Response>',
        code: [
          'export async function GET(req: Request) {',
          '  const filters = parseQuery(new URL(req.url));',
          '  const orders = await listOrders(filters);',
          '  return Response.json(orders);',
          '}',
        ],
        calls: [
          { to: `${ROUTE}#parseQuery`, kind: 'call', at: 1 },
          { to: `${SVC}#listOrders`, kind: 'call', at: 2 },
        ],
        externals: [{ label: 'Response.json', pkg: 'web', at: 3 }],
        callbacks: [],
      },
      {
        name: 'parseQuery',
        params: ['url: URL'],
        returns: 'Filters',
        doc: "Reads the status from the URL, defaulting to 'open'.",
        complexity: 2,
        signature: 'function parseQuery(url: URL): Filters',
        code: [
          'function parseQuery(url: URL): Filters {',
          "  const status = url.searchParams.get('status');",
          "  return { status: status ?? 'open' };",
          '}',
        ],
        calls: [],
        externals: [],
        callbacks: [],
      },
    ],
  },
  {
    path: SVC,
    tag: 'server',
    imports: [DB],
    head: [
      "import { query } from '@/lib/db';",
      "import type { Filters, Order } from '@/lib/types';",
      '',
      'const hooks: Record<string, (rows: Order[]) => void> = {};',
    ],
    fns: [
      {
        name: 'listOrders',
        params: ['filters: Filters'],
        returns: 'Promise<Order[]>',
        doc: 'Loads orders from the database, runs hooks and filters.',
        complexity: 2,
        signature: 'export async function listOrders(filters: Filters): Promise<Order[]>',
        code: [
          'export async function listOrders(filters: Filters) {',
          "  const rows = await query('SELECT * FROM orders');",
          "  hooks[filters.status ?? 'all']?.(rows);",
          '  return applyFilters(rows, filters);',
          '}',
        ],
        calls: [
          { to: `${DB}#query`, kind: 'call', at: 1 },
          { to: `${SVC}#applyFilters`, kind: 'call', at: 3 },
        ],
        externals: [{ label: 'hooks[…]?.()', pkg: null, at: 2 }],
        callbacks: [],
      },
      {
        name: 'applyFilters',
        params: ['rows: Order[]', 'f: Filters'],
        returns: 'Order[]',
        doc: 'Keeps only the orders with the requested status.',
        complexity: 2,
        signature: 'function applyFilters(rows: Order[], f: Filters): Order[]',
        code: [
          'function applyFilters(rows: Order[], f: Filters): Order[] {',
          '  if (!f.status) return rows;',
          '  return rows.filter((r) => r.status === f.status);',
          '}',
        ],
        calls: [],
        externals: [],
        callbacks: [{ name: 'filter', label: 'rows.filter((r) => …)', at: 2 }],
      },
    ],
  },
  {
    path: DB,
    tag: 'server',
    imports: [],
    head: ["import { Pool } from 'pg';", '', 'const pool = new Pool({ connectionString: process.env.DATABASE_URL });'],
    fns: [
      {
        name: 'query',
        params: ['sql: string'],
        returns: 'Promise<Row[]>',
        doc: 'Runs SQL using a connection from the pool.',
        complexity: 1,
        signature: 'export async function query(sql: string): Promise<Row[]>',
        code: [
          'export async function query(sql: string): Promise<Row[]> {',
          '  const conn = await pool.connect();',
          '  try {',
          '    return (await conn.query(sql)).rows;',
          '  } finally {',
          '    conn.release();',
          '  }',
          '}',
        ],
        calls: [],
        externals: [{ label: 'pool.connect', pkg: 'pg', at: 1 }],
        callbacks: [],
      },
    ],
  },
]

// ── Build the full (unscoped) index once ──

interface IndexedProject {
  sources: Map<string, string>
  files: Omit<GraphFile, 'level' | 'scope'>[]
  functions: Omit<GraphFunction, 'distance' | 'scope' | 'fanIn' | 'fanOut'>[]
  edges: GraphEdge[]
  externals: ExternalCall[]
}

function buildIndex(): IndexedProject {
  const sources = new Map<string, string>()
  const files: IndexedProject['files'] = []
  const functions: IndexedProject['functions'] = []
  const edges: GraphEdge[] = []
  const externals: ExternalCall[] = []

  for (const file of SAMPLE) {
    const lines = [...file.head, '']
    const fnIds: string[] = []
    file.fns.forEach((fn, k) => {
      if (k > 0) lines.push('')
      const startLine = lines.length + 1
      const id = `${file.path}#${fn.name}`
      fnIds.push(id)
      lines.push(...fn.code)

      const callbackIds = fn.callbacks.map((cb) => `${id}/${cb.name}@${startLine + cb.at}`)
      functions.push({
        id,
        fileId: file.path,
        name: fn.name,
        kind: /^[A-Z]/.test(fn.name) && fn.returns.includes('JSX') ? 'component' : 'function',
        parentId: null,
        startLine,
        endLine: startLine + fn.code.length - 1,
        signature: fn.signature,
        params: fn.params,
        returns: fn.returns,
        docSummary: fn.doc,
        loc: fn.code.length,
        complexity: fn.complexity,
        callbackIds,
      })
      fn.callbacks.forEach((cb, i) => {
        functions.push({
          id: callbackIds[i],
          fileId: file.path,
          name: cb.label,
          kind: 'callback',
          parentId: id,
          startLine: startLine + cb.at,
          endLine: startLine + cb.at + 1,
          signature: cb.label,
          params: [],
          returns: null,
          docSummary: null,
          loc: 2,
          complexity: 1,
          callbackIds: [],
        })
      })
      for (const call of fn.calls) {
        const from = call.inCallback
          ? callbackIds[fn.callbacks.findIndex((c) => c.name === call.inCallback)]
          : id
        edges.push({ from, to: call.to, kind: call.kind, resolution: 'lsp', line: startLine + call.at })
      }
      for (const ext of fn.externals) {
        externals.push({ from: id, label: ext.label, pkg: ext.pkg, unresolved: ext.pkg === null, line: startLine + ext.at })
      }
    })
    sources.set(file.path, lines.join('\n'))
    files.push({ id: file.path, path: file.path, tag: file.tag, lineCount: lines.length, imports: file.imports, classes: [] })
  }
  return { sources, files, functions, edges, externals }
}

const INDEX = buildIndex()

// ── Scope (mirrors services/codegraph/scope.rs) ──

function rootOf(fnId: string, byId: Map<string, IndexedProject['functions'][number]>): string {
  let cur = byId.get(fnId)
  while (cur && cur.parentId) cur = byId.get(cur.parentId)
  return cur ? cur.id : fnId
}

function bfs(start: string, adjacency: Map<string, string[]>): Map<string, number> {
  const dist = new Map<string, number>([[start, 0]])
  const queue = [start]
  while (queue.length) {
    const cur = queue.shift() as string
    for (const next of adjacency.get(cur) ?? []) {
      if (!dist.has(next)) {
        dist.set(next, (dist.get(cur) as number) + 1)
        queue.push(next)
      }
    }
  }
  return dist
}

function pushAdj(adj: Map<string, string[]>, a: string, b: string) {
  if (a === b) return
  const list = adj.get(a) ?? []
  if (!list.includes(b)) list.push(b)
  adj.set(a, list)
}

export function analyzeSample(projectId: string, params: AnalyzeParams): CodeGraph {
  const maxNodes = params.maxNodes ?? 200
  const byId = new Map(INDEX.functions.map((f) => [f.id, f]))
  const topLevel = INDEX.functions.filter((f) => f.kind !== 'callback')

  // Fan-in / fan-out on top-level functions (calls inside callbacks count for the parent).
  const fanIn = new Map<string, number>()
  const fanOut = new Map<string, number>()
  for (const e of INDEX.edges) {
    const from = rootOf(e.from, byId)
    fanOut.set(from, (fanOut.get(from) ?? 0) + 1)
    fanIn.set(e.to, (fanIn.get(e.to) ?? 0) + 1)
  }

  let distanceOf: (fnId: string) => number | undefined
  let fileLevel = new Map<string, number>()
  let entry: string
  let recommendedDepth: number
  let recommendedReason: string

  if (params.mode === 'file') {
    entry = params.entry && INDEX.sources.has(params.entry) ? params.entry : PAGE
    const adj = new Map<string, string[]>()
    for (const f of INDEX.files) for (const imp of f.imports) pushAdj(adj, f.id, imp)
    for (const e of INDEX.edges) {
      if (e.kind === 'http') pushAdj(adj, byId.get(e.from)?.fileId ?? '', byId.get(e.to)?.fileId ?? '')
    }
    fileLevel = bfs(entry, adj)
    distanceOf = (fnId) => fileLevel.get(byId.get(fnId)?.fileId ?? '')
    const maxLevel = Math.max(...fileLevel.values())
    let best = 1
    for (let d = 1; d <= maxLevel; d++) {
      const count = topLevel.filter((f) => (fileLevel.get(f.fileId) ?? Infinity) <= d).length
      if (count <= maxNodes * 0.6) best = d
    }
    recommendedDepth = Math.max(1, Math.min(5, best))
    recommendedReason = `${INDEX.files.length} files, ${topLevel.length} functions`
  } else {
    entry = params.entry && byId.has(params.entry) ? params.entry : `${PAGE}#DashboardPage`
    entry = rootOf(entry, byId)
    const adj = new Map<string, string[]>()
    for (const e of INDEX.edges) pushAdj(adj, rootOf(e.from, byId), e.to)
    const dist = bfs(entry, adj)
    distanceOf = (fnId) => dist.get(rootOf(fnId, byId))
    const leaves = topLevel.filter((f) => dist.has(f.id) && !(adj.get(f.id)?.length))
    const chains = leaves.map((f) => dist.get(f.id) as number).sort((a, b) => a - b)
    const median = chains.length ? chains[Math.floor(chains.length / 2)] : 2
    recommendedDepth = Math.max(2, Math.min(6, median))
    recommendedReason = `median call chain of ${median}`
  }

  const depth = params.depth ?? recommendedDepth
  const classify = (d: number | undefined): Scope | null =>
    d === undefined ? null : d <= depth ? 'in' : d === depth + 1 ? 'ghost' : null

  // Node cap on top-level functions in scope.
  const inScope = topLevel
    .filter((f) => classify(distanceOf(f.id)) === 'in')
    .sort((a, b) => (distanceOf(a.id) ?? 0) - (distanceOf(b.id) ?? 0) || (fanIn.get(b.id) ?? 0) - (fanIn.get(a.id) ?? 0))
  const kept = new Set(inScope.slice(0, maxNodes).map((f) => f.id))
  const truncated = inScope.length > maxNodes

  const functions: GraphFunction[] = []
  for (const f of INDEX.functions) {
    const root = rootOf(f.id, byId)
    const scope = classify(distanceOf(root))
    if (!scope) continue
    if (scope === 'in' && !kept.has(root)) continue
    functions.push({
      ...f,
      fanIn: fanIn.get(f.id) ?? 0,
      fanOut: fanOut.get(f.id) ?? 0,
      distance: params.mode === 'function' ? (distanceOf(root) ?? null) : null,
      scope,
    })
  }
  const present = new Map(functions.map((f) => [f.id, f]))

  const files: GraphFile[] = []
  for (const file of INDEX.files) {
    const fns = functions.filter((f) => f.fileId === file.id)
    if (!fns.length) continue
    const scope: Scope = fns.some((f) => f.scope === 'in') ? 'in' : 'ghost'
    files.push({
      ...file,
      level: params.mode === 'file' ? (fileLevel.get(file.id) ?? null) : null,
      scope,
    })
  }

  const edges = INDEX.edges.filter((e) => {
    const a = present.get(e.from)
    const b = present.get(e.to)
    return a && b && (a.scope === 'in' || b.scope === 'in')
  })
  const externals = INDEX.externals.filter((x) => present.get(x.from)?.scope === 'in')

  return {
    projectId,
    mode: params.mode,
    entry,
    depth,
    recommendedDepth,
    recommendedReason,
    maxNodes,
    truncated,
    totalFunctions: topLevel.length,
    allFiles: INDEX.files.map((f) => ({
      id: f.id,
      path: f.path,
      tag: f.tag,
      functionNames: topLevel.filter((fn) => fn.fileId === f.id).map((fn) => ({ id: fn.id, name: fn.name })),
    })),
    files,
    functions,
    edges,
    externals,
    analyzer: { mode: 'lsp', nodeVersion: 'v22 (mock)', lspVersion: '4.3 (mock)', parser: 'tree-sitter-typescript' },
    cache: { files: INDEX.files.length, hits: INDEX.files.length },
    analyzedAt: new Date().toISOString(),
  }
}

// ── Source tokens (stand-in for tree-sitter highlight spans) ──

const KEYWORDS = new Set([
  'import', 'from', 'export', 'default', 'async', 'await', 'function', 'return', 'const', 'let', 'var',
  'if', 'else', 'for', 'of', 'in', 'while', 'throw', 'new', 'try', 'catch', 'finally', 'as', 'type',
  'interface', 'class', 'extends', 'typeof', 'null', 'undefined', 'true', 'false',
  'string', 'number', 'boolean', 'void', 'never', 'unknown', 'any',
])

const TOKEN_RE = /(`[^`]*`|'[^']*'|"[^"]*"|\/\/.*$|\b\d+(?:\.\d+)?\b|[A-Za-z_$][\w$]*|\s+|.)/g

export function tokenizeSource(text: string): SourceToken[] {
  const tokens: SourceToken[] = []
  text.split('\n').forEach((lineText, i) => {
    let col = 0
    const parts = lineText.match(TOKEN_RE) ?? []
    parts.forEach((p, j) => {
      let kind: TokenKind = 'plain'
      if (/^[`'"]/.test(p)) kind = 'string'
      else if (p.startsWith('//')) kind = 'comment'
      else if (/^\d/.test(p)) kind = 'number'
      else if (/^[A-Za-z_$]/.test(p)) {
        if (KEYWORDS.has(p)) kind = 'keyword'
        else if (/^[A-Z]/.test(p)) kind = 'type'
        else if (/^[(<]/.test(parts.slice(j + 1).join(''))) kind = 'function'
      } else if (!/^\s+$/.test(p)) kind = 'punctuation'
      if (kind !== 'plain') tokens.push({ line: i + 1, start: col, end: col + p.length, kind })
      col += p.length
    })
  })
  return tokens
}

// ── Offline docs (stand-in for an installed documentation pack) ──

const DOCS: Record<string, Omit<KeywordDoc, 'term' | 'source'>> = {
  import: { category: 'reserved word · modules', text: 'Brings into this file something another module exported. In File mode, each direct import from the entry file counts as one level of depth.', example: "import { sum } from './math';" },
  from: { category: 'contextual keyword · modules', text: 'Says which module the import comes from. Paths starting with @/ are aliases configured in tsconfig and point to the project root.', example: "import React from 'react';" },
  type: { category: 'contextual keyword · TypeScript', text: 'Creates a type alias. In `import type`, it imports type information only, which disappears completely from the emitted JavaScript.', example: 'type Id = string | number;' },
  export: { category: 'reserved word · modules', text: 'Makes the declaration visible to other modules. Without export, the function only exists inside this file and cannot be imported.', example: 'export function sum(a, b) { return a + b; }' },
  default: { category: 'reserved word · modules', text: "Marks the module's default export. Whoever imports it chooses the name. Next.js uses the default export of page.tsx as the route's page.", example: "import Page from './page';" },
  async: { category: 'reserved word · async', text: 'Declares an asynchronous function. It always returns a Promise and may use await in its body. In Next.js Server Components the whole page can be async.', example: 'async function load() { return 42; } // Promise<number>' },
  function: { category: 'reserved word · declarations', text: 'Declares a named function. Function declarations are hoisted: they can be called before the line where they appear in the file.', example: 'function double(n: number) { return n * 2; }' },
  await: { category: 'reserved word · async', text: 'Pauses the async function until the Promise settles and hands back the resolved value. If the Promise rejects, the error is thrown right at this point.', example: 'const data = await fetch(url);' },
  const: { category: 'reserved word · variables', text: 'Creates a binding that cannot be reassigned. The value itself can still be mutable: a const array accepts push.', example: 'const items = []; items.push(1); // ok' },
  let: { category: 'reserved word · variables', text: 'Declares a block-scoped variable that can be reassigned. Prefer const when there is no reassignment.', example: 'let total = 0; total += 10;' },
  return: { category: 'reserved word · control flow', text: 'Ends the function and gives a value back to the caller. Without a value, the function returns undefined.', example: 'return result;' },
  for: { category: 'reserved word · loops', text: 'Repeats a block. The for...of form walks the values of an iterable such as arrays, strings and Maps.', example: 'for (const item of list) console.log(item);' },
  of: { category: 'contextual keyword · loops', text: 'Used in for...of to iterate over the values of an iterable, not over indexes or keys (that would be for...in).', example: "for (const letter of 'abc') {}" },
  if: { category: 'reserved word · control flow', text: 'Runs the next block only when the condition is truthy. Can be followed by else.', example: 'if (!user) return null;' },
  throw: { category: 'reserved word · errors', text: 'Throws an exception and stops execution until the nearest try/catch up the call stack.', example: "throw new Error('failed');" },
  new: { category: 'reserved word · objects', text: "Creates an instance by calling a class's constructor, as in new URL(...) or new Error(...).", example: "const url = new URL('https://example.com');" },
  try: { category: 'reserved word · errors', text: 'Starts a protected block. Errors thrown inside can be handled in catch, and finally always runs.', example: 'try { risky(); } catch (e) { log(e); }' },
  finally: { category: 'reserved word · errors', text: 'A block that always runs after try, with or without an error, even after a return. Ideal for releasing resources such as connections.', example: 'try { use(); } finally { close(); }' },
  as: { category: 'contextual keyword · TypeScript', text: 'Type assertion: asks the compiler to treat the expression as another type. It converts nothing at runtime, so use it with care.', example: 'const n = value as number;' },
  string: { category: 'primitive type · TypeScript', text: 'Primitive type for text. In annotations it restricts the value to strings and enables string methods in autocomplete.', example: "let name: string = 'Rafa';" },
}

const AWAIT_EXPLANATION: Omit<TermExplanation, 'term' | 'where'> = {
  summary: 'await makes the function wait for the result of something slow, like a network or database call, before moving to the next line.',
  example:
    'async function example() {\n  const orders = await loadOrders(); // waits here\n  console.log(orders.length);       // runs only after\n}\n\n// without await:\nconst p = loadOrders();\nconsole.log(p); // Promise { <pending> }, not the data yet',
  steps: [
    'The function on the right of await returns a Promise, a promise that the value will arrive.',
    'await pauses only this function. The rest of the app keeps running normally.',
    'When the Promise resolves, await hands over the value and the next line runs.',
  ],
  attention: 'await only works inside async functions. Forgetting await is a common bug: the variable gets the Promise instead of the data.',
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

export class MockCodeGraphService implements ICodeGraphService {
  private explainRun = 0

  async getStatus(): Promise<CodeGraphStatus> {
    return { nodeVersion: 'v22 (mock)', lsp: 'ready', lspPath: null, analyzerMode: 'lsp' }
  }

  async analyze(projectId: string, params: AnalyzeParams): Promise<CodeGraph> {
    await delay(120)
    return analyzeSample(projectId, params)
  }

  async getSource(_projectId: string, fileId: string): Promise<SourceFile> {
    const text = INDEX.sources.get(fileId)
    if (text === undefined) throw new Error(`File not found: ${fileId}`)
    return { fileId, text, tokens: tokenizeSource(text) }
  }

  async getKeywordDoc(_language: string, term: string): Promise<KeywordDoc | null> {
    const doc = DOCS[term]
    return doc ? { term, ...doc, source: 'TypeScript pack (mock)' } : null
  }

  async explainTerm(_projectId: string, request: ExplainTermRequest): Promise<TermExplanation> {
    const run = ++this.explainRun
    await delay(900)
    if (run !== this.explainRun) throw new Error('Cancelled')
    const fn = INDEX.functions.find((f) => f.id === request.functionId)
    const where = `${fn ? fn.name : request.fileId}, line ${request.line}`
    if (request.term === 'await') return { term: 'await', where, ...AWAIT_EXPLANATION }
    const doc = DOCS[request.term]
    return {
      term: request.term,
      where,
      summary: doc ? doc.text : `Mock explanation for "${request.term}".`,
      example: doc ? doc.example : '',
      steps: ['The real app asks the configured AI provider for a didactic explanation of this term in this line.'],
      attention: 'Mock data: only "await" has a full sample explanation.',
    }
  }

  async cancelExplain(): Promise<void> {
    this.explainRun++
  }
}
