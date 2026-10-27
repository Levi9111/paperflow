import { invoke } from "@tauri-apps/api/core";
import { DocDetails } from "../types/pdf";

const cache = new Map<string, DocDetails>();

export async function getCachedDocDetails(path: string): Promise<DocDetails> {
  if (cache.has(path)) {
    return cache.get(path)!;
  }

  try {
    const details = await invoke<DocDetails>("get_doc_details", { path });
    cache.set(path, details);
    return details;
  } catch {
    const filename = path.replace(/\\/g, "/").split("/").pop() || "document.pdf";
    const fallback: DocDetails = {
      path,
      filename,
      page_count: 1,
      file_size: 0,
    };
    cache.set(path, fallback);
    return fallback;
  }
}

export function invalidateDocCache(path?: string) {
  if (path) {
    cache.delete(path);
  } else {
    cache.clear();
  }
}
