# 📄 PaperFlow — Fast, On-Device PDF Studio

[![Platform](https://img.shields.io/badge/Platform-Fedora%20Linux%20%7C%20Desktop-coral)](https://github.com/Levi9111/paperflow)
[![Rust](https://img.shields.io/badge/Rust-Core%20Engine-orange.svg)](https://www.rust-lang.org/)
[![Tauri](https://img.shields.io/badge/Tauri-v2%20Shell-24C8D8.svg)](https://tauri.app/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> **Fast, private, and local PDF manipulation for everyday workflows.**

PaperFlow is a high-performance desktop PDF management application built with a pure Rust processing engine and a responsive Tauri v2 + React 19 interface. All document manipulations occur 100% locally on your hardware with zero cloud dependencies or subscriptions.

---

## 🚀 Key Features

### 🗂️ Document Operations
- **Merge PDF**: Combine multiple PDF files with visual reordering, page counts, and instant preview.
- **Split PDF**: Extract page ranges (e.g. `1-3, 5, 8-10`) or sequential spans with live client-side syntax validation.
- **Rotate Pages**: Rotate individual pages or whole documents by 90°, 180°, or 270° with interactive orientation preview.
- **Smart Compression**: Optimize file size across multiple presets (`Extreme`, `Recommended`, `High Quality`).
- **Images to PDF**: Convert JPG, PNG, and WebP images into unified PDF documents with custom page sizing presets (`Fit Image`, `A4`, `US Letter`).
- **Metadata Audit & Sanitization**: Inspect document version, page count, and encryption state, and wipe sensitive metadata tags with one click.

### ⚡ Desktop Experience
- **Full Drag & Drop**: Drop PDF files or images directly onto any tool view or drop zone.
- **Keyboard Shortcuts**:
  - `Ctrl + 1` ... `Ctrl + 6`: Instantly switch between tools.
  - `Ctrl + O`: Open file picker for the active tool.
  - `Esc`: Dismiss modals and overlays.
- **Non-blocking Status Toasts**: Immediate visual feedback for file loading, queue updates, and completions.
- **Modern Dark Obsidian UI**: Refined 4–6px geometry, subtle borders, and clutter-free personal desktop layout.

---

## 🛠️ Building & Development

### Prerequisites
- [Rust toolchain](https://rustup.rs/) (edition 2021)
- [Node.js](https://nodejs.org/) & [pnpm](https://pnpm.io/)
- Tauri development dependencies (e.g. `webkit2gtk-4.1` on Fedora)

### 1. Run Unit Tests (Rust Core)
```bash
cargo test --workspace
```

### 2. Run Desktop App in Development
```bash
cd app_shell
pnpm install
pnpm tauri dev
```

### 3. Build Production Desktop Bundle
```bash
cd app_shell
pnpm build
cargo tauri build
```
The compiled native executable will be located at:
```bash
app_shell/src-tauri/target/release/app_shell
```

### 4. Headless CLI Usage
You can also build and use the standalone CLI tool:
```bash
cargo build --release -p paperflow-cli

# Merge files
./target/release/paperflow merge -i doc1.pdf -i doc2.pdf -o combined.pdf

# Split specific ranges
./target/release/paperflow split -i doc.pdf -r "1-3, 5" -o extracted.pdf

# Rotate entire document
./target/release/paperflow rotate -i doc.pdf -a 90 --all -o rotated.pdf

# Inspect metadata
./target/release/paperflow meta -i doc.pdf
```

---

## 🏛️ Architecture

Detailed architecture and design specifications are documented in [docs/architecture.md](docs/architecture.md).

---

## 📜 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
