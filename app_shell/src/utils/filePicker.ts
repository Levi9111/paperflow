import { open } from "@tauri-apps/plugin-dialog";
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
      console.warn("Tauri dialog failed, falling back to browser input:", err);
    }
  }

  // Universal Browser fallback: triggers standard browser file dialog
  return new Promise<string[]>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = options.multiple ?? false;
    if (options.extensions && options.extensions.length > 0) {
      input.accept = options.extensions.map((ext) => `.${ext.replace(/^\./, "")}`).join(",");
    }

    let resolved = false;

    input.onchange = () => {
      resolved = true;
      const files = Array.from(input.files || []);
      const paths = files.map((f) => registerBrowserFile(f));
      resolve(paths);
      input.remove();
    };

    // Handle cancel detection
    window.addEventListener(
      "focus",
      () => {
        setTimeout(() => {
          if (!resolved) {
            resolve([]);
            input.remove();
          }
        }, 500);
      },
      { once: true }
    );

    input.click();
  });
}
