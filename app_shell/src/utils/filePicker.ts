import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { registerBrowserFile } from "./docCache";
import { isTauriEnvironment } from "./platform";

export interface FilePickerOptions {
  multiple?: boolean;
  acceptLabel?: string;
  extensions?: string[];
}

export async function pickFiles(options: FilePickerOptions = {}): Promise<string[]> {
  const isTauri = isTauriEnvironment();

  if (isTauri) {
    try {
      const selected = await open({
        multiple: options.multiple ?? false,
        filters: options.extensions
          ? [{ name: options.acceptLabel || "Files", extensions: options.extensions }]
          : undefined,
      });
      if (selected) {
        return Array.isArray(selected) ? selected : [selected];
      }
      return [];
    } catch (err) {
      console.warn("Tauri dialog failed, falling back to file input:", err);
    }
  }

  // File picker fallback (works reliably in WebView and browsers)
  return new Promise<string[]>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = options.multiple ?? false;
    if (options.extensions && options.extensions.length > 0) {
      input.accept = options.extensions.map((ext) => `.${ext.replace(/^\./, "")}`).join(",");
    }

    let resolved = false;

    input.onchange = async () => {
      resolved = true;
      const files = Array.from(input.files || []);
      const paths: string[] = [];

      for (const file of files) {
        if (isTauri) {
          try {
            const buffer = await file.arrayBuffer();
            const localPath = await invoke<string>("cache_uploaded_file", {
              filename: file.name,
              data: Array.from(new Uint8Array(buffer)),
            });
            paths.push(localPath);
            continue;
          } catch (e) {
            console.error("Failed to cache file via Tauri:", e);
          }
        }
        paths.push(registerBrowserFile(file));
      }

      resolve(paths);
      input.remove();
    };

    window.addEventListener(
      "focus",
      () => {
        setTimeout(() => {
          if (!resolved) {
            resolve([]);
            input.remove();
          }
        }, 800);
      },
      { once: true }
    );

    input.click();
  });
}
