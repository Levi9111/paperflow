# Changelog

All notable changes to PaperFlow are documented in this file.

## [1.0.0] - 2026-10-26

### Added
- **Core Engine (`paperflow-core`)**:
  - Pure Rust PDF stream processor with zero-copy object management.
  - Non-destructive `merge` engine with cross-reference table rebuild.
  - Range-based `split` extractor for arbitrary intervals and page sets.
  - In-place page rotation transformations (`90°`, `180°`, `270°`).
  - Document metadata reader and privacy sanitization filter.
  - Multi-tier compression engine (`Extreme`, `Recommended`, `HighQuality`).
  - Image to PDF converter for PNG, JPEG, and WebP assets.
  - Atomic `CancelToken` and thread-safe `JobContext` progress reporter.
- **Command Line Interface (`paperflow-cli`)**:
  - `info`, `merge`, `split`, `rotate`, `meta`, `compress`, and `img2pdf` commands.
- **Desktop & Mobile Shell (`app_shell`)**:
  - Tauri v2 shell integration with React 19 + TypeScript frontend.
  - Dark obsidian theme with radiant coral and violet gradients.
- **Packaging & Sandboxing**:
  - Fedora FreeDesktop desktop entry and AppStream 0.16+ metainfo.
  - Flathub-compatible Flatpak manifest with network access sandbox restriction.
  - Hardened Android manifest with zero network permissions.
