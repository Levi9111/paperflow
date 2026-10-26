use std::path::{Path, PathBuf};
use paperflow_core::{JobContext, PaperFlowEngine};

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
fn pdf_rotate(input: String, page: u32, delta: i64, output: String) -> Result<(), String> {
    let in_path = PathBuf::from(&input);
    let out_path = PathBuf::from(&output);

    PaperFlowEngine::rotate_page(&in_path, page, delta, &out_path)
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            pdf_info,
            pdf_merge,
            pdf_split,
            pdf_rotate,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
