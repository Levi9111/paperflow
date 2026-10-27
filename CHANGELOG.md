# Changelog

All notable changes to PaperFlow are documented in this file.

## [0.1.0] - 2026-10-27

### Added
- **Core Engine (`paperflow-core`)**:
  - Robust page range parser (`PaperFlowEngine::parse_page_ranges`) supporting arbitrary intervals (e.g. `1-3, 5, 8-10`) with full validation and unit test suite.
  - Page size preset support (`image_to_pdf_with_size`) supporting `FitImage`, `A4`, and `Letter`.
  - Extended document metadata extraction for PDF version, encryption status, and page counts.
  - Document-wide page rotation helper (`PaperFlowEngine::rotate_all_pages`).
- **Headless CLI (`paperflow-cli`)**:
  - Flag `--all` for `rotate` command to rotate all document pages simultaneously.
  - Expanded `meta` command displaying encryption status, PDF version, and page count.
- **Desktop UI (`app_shell`)**:
  - Full native Drag & Drop support replacing manual text input.
  - Global keyboard shortcuts (`Ctrl+1..6` for switching tools, `Ctrl+O` for file dialogs, `Esc` to close modals).
  - Non-blocking toast notification system for instant status updates.
  - Real-time client-side page range syntax validation and error feedback.
  - In-memory document metadata cache to minimize disk I/O.
  - Refined modern obsidian UI with sharp 4–6px geometry and clean personal header.
- **Packaging**:
  - Desktop actions for Rotate and Images-to-PDF in Flatpak `.desktop` entry.
  - Updated AppStream metainfo for v0.1.0 release.
- **Documentation**:
  - Dedicated architecture specification guide in `docs/architecture.md`.
  - Updated `README.md` with modern Rust/Tauri development steps and CLI examples.
