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
