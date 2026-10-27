import { invoke } from "@tauri-apps/api/core";
import { DocDetails } from "../types/pdf";
import { isTauriEnvironment } from "./platform";

const cache = new Map<string, DocDetails>();

export function registerBrowserFile(file: File): string {
  const path = (file as any).path || file.name;
  if (cache.has(path)) return path;

  // Approximate realistic page count for browser preview
  const estimatedPages = Math.max(1, Math.min(25, Math.round(file.size / (120 * 1024)) || 2));
  const details: DocDetails = {
    path,
    filename: file.name,
    page_count: estimatedPages,
    file_size: file.size,
  };
  cache.set(path, details);
  return path;
}

export async function getCachedDocDetails(path: string): Promise<DocDetails> {
  if (cache.has(path)) {
    return cache.get(path)!;
  }

  if (isTauriEnvironment()) {
    try {
      const details = await invoke<DocDetails>("get_doc_details", { path });
      cache.set(path, details);
      return details;
    } catch {
      // Fallback below
    }
  }

  const filename = path.replace(/\\/g, "/").split("/").pop() || "document.pdf";
  const fallback: DocDetails = {
    path,
    filename,
    page_count: 2,
    file_size: 1024 * 54,
  };
  cache.set(path, fallback);
  return fallback;
}

export function invalidateDocCache(path?: string) {
  if (path) {
    cache.delete(path);
  } else {
    cache.clear();
  }
}
