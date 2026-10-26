# 📄 PaperFlow — Privacy-First On-Device PDF Manager

[![Platform](https://img.shields.io/badge/Platforms-Fedora%20Linux%20%7C%20Android-coral)](https://github.com/paperflow/paperflow)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Offline Guarantee](https://img.shields.io/badge/Privacy-100%25%20On--Device%20%E2%80%A2%20Zero%20Network-green)](#privacy--security-guarantee)

> **Your PDFs. Your device. Nothing uploaded.**

PaperFlow is a modern, high-performance, and completely offline PDF management studio engineered for **Fedora Linux** and **Android**. Inspired by ILovePDF's comprehensive toolset, PaperFlow eliminates remote cloud dependencies, recurring subscription barriers, and data exfiltration risks by executing 100% of PDF processing locally on your hardware.

---

## 🚀 Core Features (MVP Tier)

### 🗂️ Document Organization
- **Merge PDF**: Multi-file merging with visual reordering and page selection.
- **Split PDF**: Extract specific page ranges (e.g. `1-3, 5, 8`) or burst all pages into single documents.
- **Visual Page Organizer**: Interactive thumbnail grid with one-click page rotations (90°/180°/270°), reordering, and deletion.

### ⚡ Optimization
- **Smart Compression**: Extreme (~70% reduction), Recommended (~50%), and High-Quality presets with DPI and image stream downsampling.
- **Document Flattening**: Permanently bake interactive form fields and annotation layers.

### 🔄 Conversion & Watermarking
- **Images to PDF**: Convert JPG, PNG, WebP, TIFF photos with automatic landscape orientation detection and page margins.
- **PDF to Images**: High-resolution rasterization to PNG / JPEG sequences.
- **Watermark Engine**: Custom text and stamp overlays with adjustable opacity, rotation, and font sizes.

### 👁️ Viewer & Printing
- **Interactive Viewer**: Zoom, pan, page jump, and direct native printing.

---

## 🔒 Privacy & Security Guarantee

PaperFlow is architected with **verifiable privacy**:

1. **Zero Network Permissions**:
   - **Linux Flatpak**: The manifest explicitly omits `--share=network`. The Flatpak sandbox will not permit outbound or inbound network connections.
   - **Android**: Release builds request **no `android.permission.INTERNET`**.
2. **Non-Destructive Operations**:
   - Original user files are **never** modified or overwritten in-place. All outputs are generated into target files or safe user-selected paths.
3. **Automated Temp Isolation & Purge**:
   - Intermediate files reside in `.paperflow_temp/` and are automatically deleted on completion and upon app launch.
4. **Cloud Backup Blocked**:
   - Android manifest specifies `android:allowBackup="false"` to prevent backing up sensitive documents or cache history to cloud accounts.

---

## 🛠️ Build & Installation

### Fedora Linux (Desktop)

#### 1. Compile Release Binary
```bash
flutter build linux --release
```
The compiled native ELF executable and PDFium runtime bundle will be placed at:
```bash
./build/linux/x64/release/bundle/paperflow
```

#### 2. Run Directly
```bash
./build/linux/x64/release/bundle/paperflow
```

#### 3. Flatpak Packaging
```bash
flatpak-builder --user --install --force-clean build-dir packaging/flatpak/io.github.paperflow.PaperFlow.yml
flatpak run io.github.paperflow.PaperFlow
flatpak info --show-permissions io.github.paperflow.PaperFlow
```

---

### Android

#### 1. Connect Device & Run
```bash
flutter run -d android
```

#### 2. Build Release APK (16 KB Aligned)
```bash
flutter build apk --release
```

---

## 🧪 Testing & Quality Assurance

Run the complete test suite:
```bash
flutter test
```

Includes:
- **Smoke tests**: Application mounting and shell layout validation.
- **Quality & immutability tests**: Verified bitwise non-destructive guarantees and PDF stream headers.
- **Analyzer verification**: `flutter analyze` runs with zero errors and zero warnings.
