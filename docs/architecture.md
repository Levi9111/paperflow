# PaperFlow Architecture & Engineering Guide

PaperFlow is a lightweight, high-performance, and privacy-first personal PDF manager designed for Linux and modern desktop operating systems.

```
┌─────────────────────────────────────────────────────────────┐
│                   React 19 + TypeScript                     │
│    (Obsidian UI, Drag & Drop, Keyboard Nav, Toast Alerts)    │
└──────────────────────────────┬──────────────────────────────┘
                               │ IPC Commands / Events
┌──────────────────────────────▼──────────────────────────────┐
│                    Tauri v2 Application Shell              │
│       (Window management, Native Drag-Drop, Dialogs)        │
└──────────────────────────────┬──────────────────────────────┘
                               │ Direct Rust FFI / Calls
┌──────────────────────────────▼──────────────────────────────┐
│                     paperflow-core                         │
│     (lopdf stream processing, page range parsing, img2pdf)   │
└─────────────────────────────────────────────────────────────┘
                               ▲
┌──────────────────────────────┴──────────────────────────────┐
│                      paperflow-cli                          │
│             (Headless terminal PDF Swiss-knife)             │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. Workspace Layout

- **`crates/paperflow-core/`**:
  The central, independent Rust crate handling all low-level PDF document manipulation. It depends on `lopdf` and `image`, maintaining zero network dependencies.
  - `PaperFlowEngine::merge`: Combines multiple documents into a single PDF, resolving cross-reference conflicts and re-indexing catalog trees.
  - `PaperFlowEngine::split` & `parse_page_ranges`: Extracts arbitrary page ranges (e.g. `1-3, 5, 8-10`) with comprehensive validation and bounds checking.
  - `PaperFlowEngine::rotate_pages` & `rotate_all_pages`: Modifies page `/Rotate` dictionaries with normalized `90°`, `180°`, `270°` transformations.
  - `PaperFlowEngine::compress`: Strips redundant object streams, applies Deflate filters, and optimizes object tables.
  - `PaperFlowEngine::get_metadata` & `sanitize_metadata`: Reads and cleans author, producer, and tracking metadata tags.
  - `image_to_pdf_with_size`: Converts images to PDF documents supporting `FitImage`, `A4`, and `Letter` page sizing.

- **`crates/paperflow-cli/`**:
  Headless command-line interface for automation and scripting.
  ```bash
  paperflow merge -i doc1.pdf -i doc2.pdf -o merged.pdf
  paperflow split -i doc.pdf -r "1-3, 5" -o split.pdf
  paperflow rotate -i doc.pdf -a 90 --all -o rotated.pdf
  paperflow meta -i doc.pdf
  ```

- **`app_shell/`**:
  Desktop application powered by Tauri v2 and React 19.
  - `src-tauri/`: Tauri Rust backend exposing commands (`pdf_merge`, `pdf_split`, `pdf_rotate`, `pdf_compress`, `img_to_pdf`, `get_doc_details`, `get_metadata`, `sanitize_metadata`, `show_in_folder`).
  - `src/`: React frontend written in TypeScript:
    - Native drag & drop file zones and window-level drop listeners.
    - Global keyboard shortcuts (`Ctrl+1..6`, `Ctrl+O`, `Esc`).
    - In-memory document metadata cache (`docCache.ts`).
    - Non-blocking toast notification system (`Toast.tsx`).
    - Real-time page range syntax validation (`format.ts`).
    - Modern dark obsidian aesthetic with compact 4–6px border radii.

- **`packaging/`**:
  - `flatpak/`: FreeDesktop `.desktop` entry with desktop action shortcuts, AppStream 0.16+ metainfo XML, and sandbox definitions.

---

## 2. Design Decisions & Security

1. **Non-Destructive Workflows**:
   PaperFlow never overwrites original source documents in place. All operations produce explicit destination files.
2. **Offline & Sandboxed Execution**:
   All processing takes place entirely in memory or local disk cache. No network sockets or telemetry endpoints are used.
3. **Personal Desktop Aesthetic**:
   Designed for direct everyday utility with no superfluous marketing banners or bloated multi-step wizards.
