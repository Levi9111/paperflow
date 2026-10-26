export interface DocumentStats {
  path: string;
  pageCount: number;
  sizeBytes?: number;
}

export interface SplitRequest {
  input: string;
  ranges: string;
  output: string;
}

export interface MergeRequest {
  inputs: string[];
  output: string;
}

export interface RotateRequest {
  input: string;
  page: number;
  delta: number;
  output: string;
}

export type ToolCategory = "organize" | "optimize" | "convert" | "security";
