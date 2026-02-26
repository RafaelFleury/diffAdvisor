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

## Running the Application After Build

You will find the packaged desktop application in the `src-tauri/target/release/bundle` directory. The exact subdirectory may depend on your operating system (`appimage` for Linux, `dmg` for macOS, or `msi` for Windows).

To run the built application:

### On Linux

Navigate to the `appimage` directory and execute the generated `.AppImage` file:

```bash
cd src-tauri/target/release/bundle/appimage
./diffAdvisor_*_amd64.AppImage
```

### On macOS

Navigate to the `dmg` directory and open the `.dmg` file:

```bash
cd src-tauri/target/release/bundle/dmg
open diffAdvisor_*.dmg
```
Then, drag the application to your Applications folder and launch it like any other macOS app.

### On Windows

Navigate to the `msi` directory and double-click the `.msi` installer:

```bash
cd src-tauri/target/release/bundle/msi
diffAdvisor_*.msi
```
Follow the installer prompts to complete installation, then launch the app from your Start Menu.

Refer to the [Tauri distribution documentation](https://tauri.app/v2/guides/distribution/) for advanced usage and troubleshooting.



## Tests

Rust (database layer):

```bash
cd src-tauri
cargo test --no-default-features
```

This runs 41 tests (40 unit + 1 integration) covering all CRUD operations for projects, debriefs, gaps, checkpoints, knowledge notes, and settings.
