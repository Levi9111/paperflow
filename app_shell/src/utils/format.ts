export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function getDefaultOutputPath(inputPath: string, suffix: string, ext = "pdf"): string {
  if (!inputPath) return "";
  const lastSlash = Math.max(inputPath.lastIndexOf("/"), inputPath.lastIndexOf("\\"));
  const dir = lastSlash >= 0 ? inputPath.substring(0, lastSlash + 1) : "";
  const fullName = lastSlash >= 0 ? inputPath.substring(lastSlash + 1) : inputPath;
  const lastDot = fullName.lastIndexOf(".");
  const baseName = lastDot > 0 ? fullName.substring(0, lastDot) : fullName;
  return `${dir}${baseName}_${suffix}.${ext}`;
}

export function generateDedicatedOutputPath(
  outputDir: string,
  baseNameOrInputPath: string,
  actionSuffix: string,
  ext = "pdf"
): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const timeStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(
    now.getHours()
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

  let baseName = "Document";
  if (baseNameOrInputPath) {
    const lastSlash = Math.max(baseNameOrInputPath.lastIndexOf("/"), baseNameOrInputPath.lastIndexOf("\\"));
    const rawName = lastSlash >= 0 ? baseNameOrInputPath.substring(lastSlash + 1) : baseNameOrInputPath;
    const lastDot = rawName.lastIndexOf(".");
    baseName = lastDot > 0 ? rawName.substring(0, lastDot) : rawName;
    baseName = baseName.replace(/[^a-zA-Z0-9_\-\u00C0-\u024F]/g, "_").substring(0, 40);
  }

  const filename = `${baseName}_${actionSuffix}_${timeStr}.${ext}`;
  const cleanDir = outputDir ? outputDir.replace(/[/\\]+$/, "") : "";
  const sep = cleanDir.includes("\\") && !cleanDir.includes("/") ? "\\" : "/";

  return cleanDir ? `${cleanDir}${sep}${filename}` : filename;
}

export function formatDate(timestamp: number): string {
  if (!timestamp) return "Unknown";
  const date = new Date(timestamp);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400 && date.getDate() === now.getDate()) {
    return `Today at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    hour: "2-digit",
    minute: "2-digit",
  });
}


export interface RangeValidationResult {
  valid: boolean;
  pages: number[];
  error?: string;
}

export function validatePageRanges(input: string, maxPages: number): RangeValidationResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { valid: false, pages: [], error: "Please enter at least one page number or range." };
  }

  const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) {
    return { valid: false, pages: [], error: "Please specify valid pages or ranges." };
  }

  const pagesSet = new Set<number>();

  for (const part of parts) {
    if (part.includes("-")) {
      const sides = part.split("-");
      if (sides.length !== 2) {
        return { valid: false, pages: [], error: `Invalid range syntax "${part}". Expected start-end.` };
      }
      const start = parseInt(sides[0].trim(), 10);
      const end = parseInt(sides[1].trim(), 10);
      if (isNaN(start) || isNaN(end)) {
        return { valid: false, pages: [], error: `Invalid numbers in range "${part}".` };
      }
      if (start < 1) {
        return { valid: false, pages: [], error: `Page numbers must be 1 or greater (got ${start}).` };
      }
      if (start > end) {
        return { valid: false, pages: [], error: `Start page (${start}) cannot exceed end page (${end}) in "${part}".` };
      }
      if (maxPages > 0 && end > maxPages) {
        return { valid: false, pages: [], error: `Page ${end} exceeds document page count (${maxPages}).` };
      }
      for (let i = start; i <= end; i++) {
        pagesSet.add(i);
      }
    } else {
      const page = parseInt(part, 10);
      if (isNaN(page)) {
        return { valid: false, pages: [], error: `"${part}" is not a valid page number.` };
      }
      if (page < 1) {
        return { valid: false, pages: [], error: `Page numbers must be 1 or greater (got ${page}).` };
      }
      if (maxPages > 0 && page > maxPages) {
        return { valid: false, pages: [], error: `Page ${page} exceeds document page count (${maxPages}).` };
      }
      pagesSet.add(page);
    }
  }

  const sortedPages = Array.from(pagesSet).sort((a, b) => a - b);
  return { valid: true, pages: sortedPages };
}
