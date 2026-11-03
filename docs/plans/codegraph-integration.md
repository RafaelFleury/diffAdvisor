# codeGraph Phase 1: integration notes

Phase 1 of `docs/plans/codegraph.md` (UI on mock data) is delivered as one patch on top of `main` at `8ba8c24` (the commit that raised the dark theme contrast).

## Apply

```bash
git checkout -b feature/codegraph
git am codegraph-phase1.patch      # or: git apply codegraph-phase1.patch
pnpm install                       # no new dependencies
pnpm test                          # 90 tests, 13 new
pnpm dev                           # see "Run on mock data" below
```

## New files

| File | Purpose |
|------|---------|
| `docs/plans/codegraph.md` | Full spec |
| `src/types/codegraph.ts` | Data model (mirrors the future Rust DTOs) |
| `src/services/codegraph/{types,tauri,mock,index}.ts` | Service in its own folder, mock or Tauri via `IS_MOCK_SERVICES` |
| `src/stores/codegraphStore.ts` | zustand store, session-only by design |
| `src/pages/CodeGraph.tsx` | Page |
| `src/components/features/codegraph/*` | Layout engine and components ported from the design mockup |
| `src/components/features/codegraph/__tests__/layout.test.ts` | Layout tests |
| `src/stores/__tests__/codegraphStore.test.ts` | Store tests |

## Edits to existing files

Only two, both small:

1. **`src/router.tsx`**: import `CodeGraph` and add `{ path: 'code-graph', element: <CodeGraph /> }` before the `knowledge` route.
2. **`src/components/layout/Sidebar.tsx`**: a new entry in `navItems` between Debrief and Knowledge (path `/code-graph`, graph icon). `isActive` needs no change: only indexes 0 and 1 are special-cased and the new item uses the prefix match.

`src/index.css`, `services/index.ts`, `services/types.ts`, `services/tauri.ts` and `services/mock.ts` are untouched. The palette comes from `main`.

## Run on mock data

The page uses the Tauri service when mocks are off, and the Rust commands do not exist yet (Phase 2). To see it working now, run the frontend in test mode, which turns the mocks on (`USE_MOCK = ENABLE_MOCK_SERVICES || import.meta.env.MODE === 'test'`):

```bash
pnpm exec vite --mode test
# open http://localhost:5173/code-graph
```

or set `ENABLE_MOCK_SERVICES = true` in `src/services/index.ts` temporarily.

## What is mocked

`src/services/codegraph/mock.ts` contains the sample Next.js project from the mockup (6 files, 11 functions, 2 callbacks, an HTTP route, externals and one unresolved call) and implements the scope rules of the spec in TypeScript, so File mode, Function mode, depth, ghosts and the node cap all behave as specified. Only `await` has a full AI explanation sample; other terms get a placeholder. The same sample becomes the Rust fixture in Phase 2 (`src-tauri/tests/fixtures/codegraph/shop-dashboard/`).
