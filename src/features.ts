/**
 * Build-time feature flags. Postponed features stay in the codebase but are
 * left out of the navigation and the router until their flag is turned on.
 *
 * Code Graph (docs/plans/codegraph.md) only has its phase 1 UI on mock data;
 * enable it with `VITE_ENABLE_CODE_GRAPH=true pnpm tauri dev`.
 */
export const CODE_GRAPH_ENABLED = import.meta.env.VITE_ENABLE_CODE_GRAPH === 'true'
