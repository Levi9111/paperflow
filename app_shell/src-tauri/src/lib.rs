use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use paperflow_core::{
    compress::{CompressionPreset, Compressor},
    convert::ImageConverter,
    metadata::DocumentMetadata,
    JobContext, PaperFlowEngine,
};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DocDetails {
    pub path: String,
    pub filename: String,
    pub page_count: usize,
    pub file_size: u64,
    pub title: Option<String>,
    pub author: Option<String>,
    pub creation_date: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CompressDetails {
    pub original_size: usize,
    pub compressed_size: usize,
    pub ratio_percent: f64,
}

#[tauri::command]
fn get_doc_details(path: String) -> Result<DocDetails, String> {
    let p = Path::new(&path);
    let page_count = PaperFlowEngine::get_page_count(p).map_err(|e| e.to_string())?;
    let file_size = std::fs::metadata(p).map(|m| m.len()).unwrap_or(0);
    let filename = p
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("document.pdf")
        .to_string();
    let meta = DocumentMetadata::read_from_file(p).ok();

    Ok(DocDetails {
        path: path.clone(),
        filename,
        page_count,
        file_size,
        title: meta.as_ref().and_then(|m| m.title.clone()),
        author: meta.as_ref().and_then(|m| m.author.clone()),
        creation_date: meta.as_ref().and_then(|m| m.creation_date.clone()),
    })
}

#[tauri::command]
fn pdf_info(path: String) -> Result<usize, String> {
    PaperFlowEngine::get_page_count(Path::new(&path))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn pdf_merge(inputs: Vec<String>, output: String) -> Result<usize, String> {
    let input_paths: Vec<PathBuf> = inputs.into_iter().map(PathBuf::from).collect();
    let out_path = PathBuf::from(&output);
    let ctx = JobContext::new_noop(std::env::temp_dir());

    PaperFlowEngine::merge(&input_paths, &out_path, &ctx)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn pdf_split(input: String, ranges: String, output: String) -> Result<usize, String> {
    let in_path = PathBuf::from(&input);
    let out_path = PathBuf::from(&output);
    let ctx = JobContext::new_noop(std::env::temp_dir());

    let total = PaperFlowEngine::get_page_count(&in_path)
        .map_err(|e| e.to_string())?;

    let mut pages = Vec::new();
    for part in ranges.split(',') {
        let part = part.trim();
        if part.contains('-') {
            let bounds: Vec<&str> = part.split('-').collect();
            if bounds.len() == 2 {
                if let (Ok(start), Ok(end)) = (bounds[0].trim().parse::<u32>(), bounds[1].trim().parse::<u32>()) {
                    for p in start..=end {
                        if (p as usize) <= total {
                            pages.push(p);
                        }
                    }
                }
            }
        } else if let Ok(page) = part.parse::<u32>() {
            if (page as usize) <= total {
                pages.push(page);
            }
        }
    }
    pages.sort();
    pages.dedup();

    PaperFlowEngine::split_range(&in_path, &pages, &out_path, &ctx)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn pdf_rotate(input: String, page: Option<u32>, delta: i64, output: String) -> Result<(), String> {
    let in_path = PathBuf::from(&input);
    let out_path = PathBuf::from(&output);

    if let Some(p) = page {
        PaperFlowEngine::rotate_page(&in_path, p, delta, &out_path)
            .map_err(|e| e.to_string())
    } else {
        PaperFlowEngine::rotate_all_pages(&in_path, delta, &out_path)
            .map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn pdf_compress(input: String, preset: String, output: String) -> Result<CompressDetails, String> {
    let in_path = PathBuf::from(&input);
    let out_path = PathBuf::from(&output);
    let ctx = JobContext::new_noop(std::env::temp_dir());

    let p = match preset.to_lowercase().as_str() {
        "extreme" => CompressionPreset::Extreme,
        "high" | "highquality" => CompressionPreset::HighQuality,
        _ => CompressionPreset::Recommended,
    };

    let (original_size, compressed_size) = Compressor::compress_file(&in_path, &out_path, p, &ctx)
        .map_err(|e| e.to_string())?;

    let ratio_percent = if original_size > 0 {
        ((original_size.saturating_sub(compressed_size)) as f64 / original_size as f64) * 100.0
    } else {
        0.0
    };

    Ok(CompressDetails {
        original_size,
        compressed_size,
        ratio_percent,
    })
}

#[tauri::command]
fn pdf_img2pdf(inputs: Vec<String>, output: String) -> Result<usize, String> {
    let input_paths: Vec<PathBuf> = inputs.into_iter().map(PathBuf::from).collect();
    let out_path = PathBuf::from(&output);

    ImageConverter::image_to_pdf(&input_paths, &out_path)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn pdf_sanitize_meta(input: String, output: String) -> Result<(), String> {
    let in_path = PathBuf::from(&input);
    let out_path = PathBuf::from(&output);

    DocumentMetadata::sanitize_and_save(&in_path, &out_path)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_metadata(input: String) -> Result<DocumentMetadata, String> {
    let in_path = PathBuf::from(&input);
    DocumentMetadata::read_from_file(&in_path)
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_doc_details,
            pdf_info,
            pdf_merge,
            pdf_split,
            pdf_rotate,
            pdf_compress,
            pdf_img2pdf,
            pdf_sanitize_meta,
            get_metadata,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
