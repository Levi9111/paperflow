import { invoke } from "@tauri-apps/api/core";
import { ProcessedFileRecord, DocDetails } from "../types/pdf";
import { isTauriEnvironment } from "./platform";

const HISTORY_STORAGE_KEY = "paperflow_history_v1";
const OUTPUT_DIR_STORAGE_KEY = "paperflow_output_dir_v1";

export async function getDefaultOutputDir(): Promise<string> {
  const saved = localStorage.getItem(OUTPUT_DIR_STORAGE_KEY);
  if (saved && saved.trim()) {
    return saved.trim();
  }

  if (isTauriEnvironment()) {
    try {
      const defaultDir = await invoke<string>("get_default_output_dir");
      if (defaultDir) {
        localStorage.setItem(OUTPUT_DIR_STORAGE_KEY, defaultDir);
        return defaultDir;
      }
    } catch (e) {
      console.warn("Failed to get default output dir from Tauri:", e);
    }
  }

  const fallback = "~/Documents/PaperFlow";
  localStorage.setItem(OUTPUT_DIR_STORAGE_KEY, fallback);
  return fallback;
}

export function setPreferredOutputDir(dir: string): void {
  localStorage.setItem(OUTPUT_DIR_STORAGE_KEY, dir);
  window.dispatchEvent(new CustomEvent("paperflow_dir_updated", { detail: dir }));
}

export function getHistoryRecords(): ProcessedFileRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.sort((a, b) => b.timestamp - a.timestamp);
    }
  } catch (err) {
    console.error("Failed to parse history records:", err);
  }
  return [];
}

export function addHistoryRecord(
  item: Omit<ProcessedFileRecord, "id" | "timestamp">
): ProcessedFileRecord {
  const existing = getHistoryRecords();
  const newRecord: ProcessedFileRecord = {
    ...item,
    id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
  };

  // Avoid duplicate output path entries
  const filtered = existing.filter((r) => r.outputPath !== item.outputPath);
  const updated = [newRecord, ...filtered].slice(0, 100); // Keep last 100 entries

  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("paperflow_history_updated"));
  } catch (err) {
    console.error("Failed to save history record:", err);
  }

  return newRecord;
}

export function removeHistoryRecord(id: string): void {
  const existing = getHistoryRecords();
  const updated = existing.filter((r) => r.id !== id);
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("paperflow_history_updated"));
  } catch (err) {
    console.error("Failed to remove history record:", err);
  }
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("paperflow_history_updated"));
  } catch (err) {
    console.error("Failed to clear history:", err);
  }
}

export async function syncWithDisk(outputDir: string): Promise<ProcessedFileRecord[]> {
  const current = getHistoryRecords();
  if (!isTauriEnvironment() || !outputDir) {
    return current;
  }

  try {
    const files = await invoke<DocDetails[]>("list_output_files", { dir: outputDir });
    const knownPaths = new Set(current.map((r) => r.outputPath));
    const newItems: ProcessedFileRecord[] = [];

    for (const f of files) {
      if (!knownPaths.has(f.path)) {
        // Guess action from filename if possible
        const lower = f.filename.toLowerCase();
        let action: ProcessedFileRecord["action"] = "merge";
        let actionLabel = "Processed Document";

        if (lower.includes("merge")) {
          action = "merge";
          actionLabel = "Merged Document";
        } else if (lower.includes("split")) {
          action = "split";
          actionLabel = "Split Document";
        } else if (lower.includes("rotat")) {
          action = "rotate";
          actionLabel = "Rotated Document";
        } else if (lower.includes("compress")) {
          action = "compress";
          actionLabel = "Compressed Document";
        } else if (lower.includes("img") || lower.includes("convert")) {
          action = "img2pdf";
          actionLabel = "Converted from Images";
        } else if (lower.includes("sanitiz") || lower.includes("clean")) {
          action = "sanitize";
          actionLabel = "Cleaned Metadata";
        }

        newItems.push({
          id: `disk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          outputPath: f.path,
          filename: f.filename,
          action,
          actionLabel,
          sourceFiles: [],
          timestamp: Date.now(),
          fileSize: f.file_size,
          pageCount: f.page_count,
        });
      }
    }

    if (newItems.length > 0) {
      const merged = [...current, ...newItems].sort((a, b) => b.timestamp - a.timestamp);
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(merged));
      window.dispatchEvent(new CustomEvent("paperflow_history_updated"));
      return merged;
    }
  } catch (err) {
    console.warn("syncWithDisk error:", err);
  }

  return current;
}
