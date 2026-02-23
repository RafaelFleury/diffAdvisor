# diffAdvisor

AI-powered code review and learning tool built with Tauri 2 (Rust + React/TypeScript).

## Prerequisites

- **Node.js** v18+ (v22 recommended)
- **pnpm** v8+
- **Rust** (stable)
- **System libraries** (Linux): `libgtk-3-dev libwebkit2gtk-4.1-dev librsvg2-dev patchelf`

## Setup

```bash
pnpm install
```

## Development

```bash
pnpm tauri dev
```

Frontend only (no Tauri):

```bash
pnpm dev
```

## Build

```bash
pnpm build          # frontend
pnpm tauri build    # full desktop app
```

## Tests

Rust (database layer):

```bash
cd src-tauri
cargo test --no-default-features
```

This runs 41 tests (40 unit + 1 integration) covering all CRUD operations for projects, debriefs, gaps, checkpoints, knowledge notes, and settings.
