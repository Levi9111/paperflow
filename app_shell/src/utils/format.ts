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
