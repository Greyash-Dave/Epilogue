
# Epilogue – Your books, your atmosphere

A **beautiful, minimalist EPUB reader** for desktop with **atmospheric backgrounds, custom presets, and an ad‑free reading experience**.  
Tune the mood with images, glassy overlays, and your own music while you read.

![Status](https://img.shields.io/badge/status-beta-orange)
![Platform](https://img.shields.io/badge/platform-Desktop-blue)
![License](https://img.shields.io/github/license/Greyash-Dave/Epilogue)

---

## 📥 Download Epilogue

**➡️ [Download the latest version for Windows](https://github.com/Greyash-Dave/Epilogue/releases/latest)**

- Lightweight installer, no accounts, no ads.
- Your books stay on your device – Epilogue reads local EPUB files only.

*Note: For macOS and Linux, please build from source (see “For developers & Linux/macOS” below).*

---

## ✨ Why Epilogue?

- **Distraction‑free**: Clean, keyboard‑friendly reading UI with no clutter.
- **Atmospheric**: Set the mood with backgrounds, color overlays, and opacity.
- **Custom presets**: Save complete “vibes” (background + colors + music) for each book or genre.
- **Fast & native**: Built with Tauri (Rust) for low memory usage and snappy startup.
- **Private & offline**: Everything runs locally on your machine.

Imagine:
- A light, cozy preset with warm image + soft music for a slice‑of‑life novel.
- A dark, high‑contrast preset with moody track for a grimdark fantasy.

Switch between them in a couple of keypresses.

---

## 🌌 Atmospheres, backgrounds & music

Epilogue lets you build your own reading ambience:

- **Backgrounds**
  - Use simple images, wallpapers, or static frames from your favorite scenes.
  - Glass‑effect overlays and adjustable reader opacity keep text readable.
- **Color & text**
  - Control background color, overlay color, and text color to match the book’s tone.
- **Music & audio**
  - Play your own local music in the background while reading to complete the vibe.
- **Presets**
  - Save all of the above as named presets and reuse them per book, series, or mood.

---

## 📚 Reading experience

- **EPUB support** via `epub.js`
- Paginated reading mode with smooth navigation
- Quick jump between pages with keyboard
- Works completely offline once installed

---

## ⌨️ Keyboard shortcuts

| Shortcut      | Action                    |
|---------------|---------------------------|
| `Ctrl/Cmd+O`  | Open EPUB file            |
| `Ctrl/Cmd+P`  | Open presets panel        |
| `→` or `L`    | Next page                 |
| `←` or `H`    | Previous page             |
| `F`           | Toggle fullscreen         |
| `?`           | Show keyboard shortcuts   |

Use these and you can comfortably read without touching the mouse.

---

## 🧰 For Developers & Linux/macOS users

You can build Epilogue yourself on Windows, macOS, or Linux.

### Prerequisites

- **Node.js 16+** and npm
- **Rust** toolchain
- **Tauri CLI**

Install Rust:

```bash
# Windows (PowerShell)
winget install --id Rustlang.Rustup

# macOS/Linux
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
Verify:

bash
rustc --version
cargo --version
```

Install Tauri CLI:

```bash
cargo install tauri-cli
```

1. Clone the repository
```bash
git clone https://github.com/Greyash-Dave/Epilogue.git
cd Epilogue
```

2. Development mode (all platforms)
```bash
# Install frontend dependencies
npm install

# Run full desktop app with hot reload
cargo tauri dev
```
This will:

- Compile the Rust backend
- Start the Vite dev server
- Launch the desktop app with hot‑reload for frontend + backend

Frontend‑only mode (no Tauri)
```bash
npm run dev
```
File operations will not work in this mode; it’s only for UI development.

3. Production builds
- **Windows (.exe / .msi)**
```bash
npm install
cargo tauri build
```
Output:
```
src-tauri/target/release/bundle/nsis/Epilogue_x.x.x_x64-setup.exe
src-tauri/target/release/bundle/msi/Epilogue_x.x.x_x64_en-US.msi
```

- **Linux (.deb / .AppImage)**
Build Linux artifacts on a Linux system (native or WSL2). Cross‑compiling from Windows is usually not supported due to system library dependencies.

Install system dependencies (Ubuntu/Debian example):
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

Build:
```bash
npm install
cargo tauri build
```

Artifacts:
```
src-tauri/target/release/bundle/deb/
src-tauri/target/release/bundle/appimage/
```

- **macOS (.dmg)**
On macOS (with Xcode Command Line Tools installed):
```bash
xcode-select --install   # if not already installed
npm install
cargo tauri build
```
The .dmg installer will be generated under `src-tauri/target/release/bundle/`.

---

🗂 Project structure
```
Epilogue/
├── src/
│   ├── index.html              # Main HTML structure
│   ├── styles/                 # CSS modules
│   │   ├── main.css            # Global styles & design system
│   │   ├── layers.css          # Layer stacking system
│   │   ├── reader.css          # EPUB reader styles
│   │   └── presets.css         # Preset panel styles
│   ├── scripts/                # JavaScript modules
│   │   ├── main.js             # App entry point
│   │   ├── reader.js           # EpubReader class
│   │   ├── background.js       # BackgroundManager class
│   │   ├── overlay.js          # OverlayManager class
│   │   ├── presets.js          # PresetManager class
│   │   └── ui.js               # UI utilities
│   └── assets/
│       └── presets/
│           └── backgrounds/    # Placeholder backgrounds
├── package.json
├── vite.config.js
└── README.md
```

### Available scripts
```bash
# Frontend only
npm run dev       # Start Vite dev server
npm run build     # Build frontend for production
npm run preview   # Preview frontend build

# Desktop app (Tauri)
cargo tauri dev   # Run full desktop app in dev
cargo tauri build # Build desktop app installer
```
  
## 📜 License
MIT License. See LICENSE for details.

If you enjoy Epilogue, consider starring ⭐ the repo and sharing it with other readers.
