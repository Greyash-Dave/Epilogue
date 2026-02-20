# EPUB Reader - "Your books, your atmosphere"

A beautiful, minimalist EPUB reader with atmospheric backgrounds and customizable mood presets.

![Status](https://img.shields.io/badge/status-in%20development-orange)
![Platform](https://img.shields.io/badge/platform-Desktop-blue)

## Overview

EPUB is a desktop application that combines EPUB reading with an atmospheric layer system. Read your favorite books while surrounded by dynamic backgrounds, color overlays, and customizable presets that match your mood.

## Current Status

**✅ Frontend Complete**
- Full UI structure with layered design
- EPUB reader integration (epub.js)
- 3 built-in atmospheric presets
- Keyboard shortcuts

**✅ Backend Complete**
- Tauri backend with Rust
- File system operations
- Preset management
- Native file dialogs

**⏳ Ready to Build**  
Requires Rust installation to compile and run.

## Features

### Desktop Application
- **Cross-platform**: Windows, macOS, Linux (via Tauri)
- **Native Performance**: Rust backend for fast file operations
- **Secure**: Sandboxed file access through Tauri permissions

### Atmospheric Reading
- **Layered Design**: Background images, color overlays, and adjustable reader opacity
- **Built-in Presets**:
  - 🔥 **Cozy Reading**: Warm fireplace ambiance
  - 🎯 **Focus Mode**: Minimal distractions
  - 🌙 **Night Reading**: Easy on the eyes

### Reading Experience
- EPUB support via epub.js
- Paginated reading mode
- Navigation controls
- Keyboard shortcuts (arrow keys, Ctrl+O, etc.)

### User Interface
- Dark theme by default
- Modal panels for presets and help
- Toast notifications for feedback
- Fully keyboard-navigable

## Getting Started

### Prerequisites

- **Node.js 16+** and npm
- **Rust** (for Tauri backend)
- **Tauri CLI**

### Installing Prerequisites

#### 1. Install Rust

```bash
# Windows (PowerShell)
winget install --id Rustlang.Rustup

# macOS/Linux
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Verify installation:
```bash
rustc --version
cargo --version
```

#### 2. Install Tauri CLI

```bash
cargo install tauri-cli
```

### Running the App

#### Development Mode (Recommended)

```bash
# Install frontend dependencies
npm install

# Start Tauri dev mode (compiles Rust + starts frontend)
cargo tauri dev
```

This will:
- Compile the Rust backend
- Start the Vite dev server
- Launch the desktop application
- Enable hot-reload for both frontend and backend

#### Web Development Mode (No Backend)

If you just want to test the frontend without Tauri:

```bash
npm run dev
```

> **Note**: File operations won't work in this mode, but you can test the UI.

### Production Build

#### Windows (.exe / .msi)
To build a standalone installer for Windows:

```bash
npm install
cargo tauri build
```

The output files will be located at:
- `src-tauri/target/release/bundle/nsis/Epilogue_x.x.x_x64-setup.exe`
- `src-tauri/target/release/bundle/msi/Epilogue_x.x.x_x64_en-US.msi`

#### Linux (.deb / .AppImage)
**Note:** You must build the Linux version **on a Linux system**. Cross-compilation from Windows is generally not supported due to C library dependencies (GTK, WebKit).

**Method A: Native Linux**
1.  **Install System Dependencies** (Ubuntu/Debian example):
    ```bash
    sudo apt update
    sudo apt install libwebkit2gtk-4.0-dev \
        build-essential \
        curl \
        wget \
        file \
        libssl-dev \
        libgtk-3-dev \
        libayatana-appindicator3-dev \
        librsvg2-dev
    ```
2.  **Build**:
    ```bash
    npm install
    cargo tauri build
    ```

**Method B: WSL2 (Windows Subsystem for Linux)**
If you are on Windows, you can use WSL2 to build the Linux version:
1.  Install Ubuntu via WSL.
2.  Install Rust (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`) and Node.js inside WSL.
3.  Install the system dependencies listed above.
4.  Clone this repository into your WSL file system.
5.  Run `npm install && cargo tauri build`.

The output will be in `src-tauri/target/release/bundle/deb/` and `src-tauri/target/release/bundle/appimage/`.

## Project Structure

```
Epilogue/
├── src/
│   ├── index.html              # Main HTML structure
│   ├── styles/                 # CSS modules
│   │   ├── main.css           # Global styles & design system
│   │   ├── layers.css         # Layer stacking system
│   │   ├── reader.css         # EPUB reader styles
│   │   └── presets.css        # Preset panel styles
│   ├── scripts/                # JavaScript modules
│   │   ├── main.js            # App entry point
│   │   ├── reader.js          # EpubReader class
│   │   ├── background.js      # BackgroundManager class
│   │   ├── overlay.js         # OverlayManager class
│   │   ├── presets.js         # PresetManager class
│   │   └── ui.js              # UI utilities
│   └── assets/                 # Images and resources
│       └── presets/
│           └── backgrounds/    # Placeholder backgrounds
├── package.json
├── vite.config.js
└── README.md
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd+O` | Open EPUB file |
| `Ctrl/Cmd+P` | Open presets panel |
| `→` or `L` | Next page |
| `←` or `H` | Previous page |
| `F` | Toggle fullscreen |
| `?` | Show keyboard shortcuts |

## Development

### Technologies

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Build Tool**: Vite 5
- **EPUB Library**: epub.js v0.3.93
- **Backend**: Tauri 1.5+ (Rust)
- **Serialization**: serde, serde_json
- **Directory Utilities**: dirs crate

### Available Scripts

```bash
# Frontend only
npm run dev      # Start Vite dev server (frontend only)
npm run build    # Build frontend for production
npm run preview  # Preview production build

# Desktop app (Tauri)
cargo tauri dev    # Run full desktop app in dev mode
cargo tauri build  # Build desktop app installer
```

## Roadmap

See [PLAN.md](./PLAN.md) for the complete 4-week implementation plan.

See [ROADMAP.md](./ROADMAP.md) for a detailed feature checklist and status report.

### Phase 1: Core Reading & Atmosphere (Completed ✅)
- [x] Basic EPUB rendering
- [x] Background/Overlay system
- [x] Preset management
- [x] Cross-platform support

### Phase 2: Library & Persistence (Next)
- [ ] Save book progress
- [ ] Library view (grid/list)
- [ ] Recent files list
- [ ] Custom user presets

### Phase 3: Polish
- [ ] Video backgrounds
- [ ] Annotations
- [ ] Full-text search

## Contributing

This project is currently in active development. Contributions will be welcome once Phase 1 is complete.

## License

TBD

## Acknowledgments

- [epub.js](https://github.com/futurepress/epub.js/) for EPUB rendering
- [Tauri](https://tauri.app/) for the desktop framework
- [Vite](https://vitejs.dev/) for the build tooling

---


# Epilogue
