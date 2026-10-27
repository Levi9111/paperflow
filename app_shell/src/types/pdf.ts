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
}

export type ToolType = 
  | "merge" 
  | "split" 
  | "rotate" 
  | "compress" 
  | "img2pdf" 
  | "inspect";
