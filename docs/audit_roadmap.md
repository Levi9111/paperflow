# PaperFlow: Architecture Decision Record & Roadmap

## Stack Selection: Path A (AGPL-3.0)
- **Core Engine**: Pure Rust `paperflow-core` leveraging `lopdf` with zero-copy stream processing.
- **Headless Tooling**: `paperflow-cli` providing terminal automation, batch processing, and CI/CD integration.
- **Desktop & Mobile Shell**: Tauri v2 with React 19 and TypeScript frontend.
- **Distribution Targets**:
  1. Fedora Linux (Flatpak sandbox via Flathub, COPR RPM)
  2. Android (APK, F-Droid source builds)

## Privacy & Sandbox Enforcement
- Strict omission of `--share=network` in Flatpak container manifest.
- Zero network permissions in Android release manifest.
- Automatic temp directory purging on startup and job termination.
- Non-destructive execution guaranteeing original documents are never modified in-place.
