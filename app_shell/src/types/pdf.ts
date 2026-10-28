export interface DocDetails {
  path: string;
  filename: string;
  page_count: number;
  file_size: number;
  title?: string;
  author?: string;
  creation_date?: string;
}

export interface CompressDetails {
  original_size: number;
  compressed_size: number;
  ratio_percent: number;
}

export interface DocumentMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creation_date?: string;
  mod_date?: string;
  version?: string;
  is_encrypted?: boolean;
  page_count?: number;
}

export type ToolType = 
  | "merge" 
  | "split" 
  | "rotate" 
  | "compress" 
  | "img2pdf" 
  | "inspect"
  | "history";

export type ProcessedActionType = "merge" | "split" | "rotate" | "compress" | "img2pdf" | "sanitize";

export interface ProcessedFileRecord {
  id: string;
  outputPath: string;
  filename: string;
  action: ProcessedActionType;
  actionLabel: string;
  sourceFiles: string[];
  timestamp: number;
  fileSize: number;
  pageCount?: number;
}

