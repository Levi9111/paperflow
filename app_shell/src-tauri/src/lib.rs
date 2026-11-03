use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use paperflow_core::{
    compress::{CompressionPreset, Compressor},
    convert::ImageConverter,
    metadata::DocumentMetadata,
    JobContext, PaperFlowEngine,
};

#[cfg(target_os = "android")]
fn resolve_single_path(path: &str) -> PathBuf {
    if !path.starts_with("content://") {
        return PathBuf::from(path);
    }
    let vm_ptr = ndk_context::android_context().vm().cast::<jni::sys::JavaVM>();
    if !vm_ptr.is_null() {
        unsafe {
            if let Ok(vm) = jni::JavaVM::from_raw(vm_ptr) {
                if let Ok(mut env) = vm.attach_current_thread() {
                    if let Ok(j_path) = env.new_string(path) {
                        if let Ok(class) = env.find_class("io/github/paperflow/app/MainActivity") {
                            let res = env.call_static_method(
                                class,
                                "resolveContentUri",
                                "(Ljava/lang/String;)Ljava/lang/String;",
                                &[jni::objects::JValue::Object(&j_path)],
                            );
                            if let Ok(val) = res {
                                if let Ok(obj) = val.l() {
                                    if !obj.is_null() {
                                        if let Ok(res_str) = env.get_string(&obj.into()) {
                                            return PathBuf::from(res_str.to_string_lossy().to_string());
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    PathBuf::from(path)
}

#[cfg(not(target_os = "android"))]
fn resolve_single_path(path: &str) -> PathBuf {
    PathBuf::from(path)
}

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
    let local = resolve_single_path(&path);
    let p = local.as_path();
    let page_count = PaperFlowEngine::get_page_count(p).map_err(|e| e.to_string())?;
    let file_size = std::fs::metadata(p).map(|m| m.len()).unwrap_or(0);
    let filename = p
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("document.pdf")
        .to_string();
    let meta = DocumentMetadata::read_from_file(p).ok();

    Ok(DocDetails {
        path: local.to_string_lossy().to_string(),
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
    let local = resolve_single_path(&path);
    PaperFlowEngine::get_page_count(&local).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_default_output_dir(app: tauri::AppHandle) -> Result<String, String> {
    use tauri::Manager;
    #[cfg(target_os = "android")]
    {
        let base_dir = app
            .path()
            .document_dir()
            .or_else(|_| app.path().app_data_dir())
            .unwrap_or_else(|_| std::env::temp_dir())
            .join("PaperFlow");

        if !base_dir.exists() {
            let _ = std::fs::create_dir_all(&base_dir);
        }
        Ok(base_dir.to_string_lossy().to_string())
    }
    #[cfg(not(target_os = "android"))]
    {
        let base_dir = std::env::var("HOME")
            .map(|h| PathBuf::from(h).join("Documents").join("PaperFlow"))
            .unwrap_or_else(|_| std::env::temp_dir().join("PaperFlow"));

        if !base_dir.exists() {
            let _ = std::fs::create_dir_all(&base_dir);
        }
        Ok(base_dir.to_string_lossy().to_string())
    }
}

#[tauri::command]
fn ensure_output_dir(dir: String) -> Result<String, String> {
    let p = PathBuf::from(&dir);
    if !p.exists() {
        std::fs::create_dir_all(&p).map_err(|e| e.to_string())?;
    }
    Ok(dir)
}

#[tauri::command]
fn cache_uploaded_file(app: tauri::AppHandle, filename: String, data: Vec<u8>) -> Result<String, String> {
    use tauri::Manager;
    let cache_dir = app
        .path()
        .app_cache_dir()
        .unwrap_or_else(|_| std::env::temp_dir())
        .join("imported");

    if !cache_dir.exists() {
        let _ = std::fs::create_dir_all(&cache_dir);
    }
    let safe_name = if filename.trim().is_empty() {
        format!(
            "doc_{}.pdf",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis())
                .unwrap_or(0)
        )
    } else {
        filename
    };
    let out_path = cache_dir.join(safe_name);
    std::fs::write(&out_path, data).map_err(|e| format!("Failed to cache file: {}", e))?;
    Ok(out_path.to_string_lossy().to_string())
}

#[tauri::command]
fn share_file(_app: tauri::AppHandle, path: String) -> Result<(), String> {
    let local = resolve_single_path(&path);
    let path_str = local.to_string_lossy().to_string();

    #[cfg(target_os = "android")]
    {
        let vm_ptr = ndk_context::android_context().vm().cast::<jni::sys::JavaVM>();
        if !vm_ptr.is_null() {
            unsafe {
                if let Ok(vm) = jni::JavaVM::from_raw(vm_ptr) {
                    if let Ok(mut env) = vm.attach_current_thread() {
                        if let Ok(j_path) = env.new_string(&path_str) {
                            if let Ok(class) = env.find_class("io/github/paperflow/app/MainActivity") {
                                let _ = env.call_static_method(
                                    class,
                                    "shareFile",
                                    "(Ljava/lang/String;)Z",
                                    &[jni::objects::JValue::Object(&j_path)],
                                );
                                return Ok(());
                            }
                        }
                    }
                }
            }
        }
        Err("Failed to invoke native share sheet".into())
    }
    #[cfg(not(target_os = "android"))]
    {
        open_folder(app, path)
    }
}

#[tauri::command]
fn open_folder(app: tauri::AppHandle, path: String) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        share_file(app, path)
    }
    #[cfg(not(target_os = "android"))]
    {
        use tauri_plugin_opener::OpenerExt;
        let local = resolve_single_path(&path);
        let target_dir = if local.is_dir() {
            local
        } else {
            local.parent().unwrap_or(&local).to_path_buf()
        };
        let _ = app.opener().reveal_item_in_dir(target_dir);
        Ok(())
    }
}

#[tauri::command]
fn open_file(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let local = resolve_single_path(&path);
    if !local.exists() {
        return Err("File does not exist on disk".into());
    }

    #[cfg(target_os = "android")]
    {
        share_file(app, path)
    }
    #[cfg(not(target_os = "android"))]
    {
        use tauri_plugin_opener::OpenerExt;
        app.opener()
            .open_path(local.to_string_lossy().as_ref(), None::<&str>)
            .map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn delete_file(path: String) -> Result<(), String> {
    let local = resolve_single_path(&path);
    if local.exists() {
        std::fs::remove_file(local).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn read_file_binary(path: String) -> Result<Vec<u8>, String> {
    let local = resolve_single_path(&path);
    if !local.exists() {
        return Err(format!("File does not exist: {}", path));
    }
    std::fs::read(local).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
fn write_file_binary(path: String, data: Vec<u8>) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if let Some(parent) = p.parent() {
        if !parent.exists() {
            let _ = std::fs::create_dir_all(parent);
        }
    }
    std::fs::write(&p, data).map_err(|e| format!("Failed to save file: {}", e))
}

#[tauri::command]
fn list_output_files(dir: String) -> Result<Vec<DocDetails>, String> {
    let p = Path::new(&dir);
    if !p.exists() {
        return Ok(Vec::new());
    }
    let mut files = Vec::new();
    if let Ok(entries) = std::fs::read_dir(p) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file()
                && path
                    .extension()
                    .and_then(|e| e.to_str())
                    .map_or(false, |ext| ext.eq_ignore_ascii_case("pdf"))
            {
                if let Ok(details) = get_doc_details(path.to_string_lossy().to_string()) {
                    files.push(details);
                }
            }
        }
    }
    files.sort_by(|a, b| {
        let meta_a = std::fs::metadata(&a.path).and_then(|m| m.modified()).ok();
        let meta_b = std::fs::metadata(&b.path).and_then(|m| m.modified()).ok();
        meta_b.cmp(&meta_a)
    });
    Ok(files)
}

#[tauri::command]
fn pdf_merge(app: tauri::AppHandle, inputs: Vec<String>, output: String) -> Result<usize, String> {
    use tauri::Manager;
    let input_paths: Vec<PathBuf> = inputs.iter().map(|s| resolve_single_path(s)).collect();
    let out_path = PathBuf::from(&output);

    // Strict non-destructive safeguard: never overwrite an input document
    if input_paths.iter().any(|p| p == &out_path) {
        return Err("Target output file cannot be the same as any input file. A new file must be created.".into());
    }

    if let Some(parent) = out_path.parent() {
        if !parent.exists() {
            let _ = std::fs::create_dir_all(parent);
        }
    }

    let temp_dir = app.path().app_cache_dir().unwrap_or_else(|_| std::env::temp_dir());
    let ctx = JobContext::new_noop(temp_dir);

    PaperFlowEngine::merge(&input_paths, &out_path, &ctx).map_err(|e| e.to_string())
}

#[tauri::command]
fn pdf_split(app: tauri::AppHandle, input: String, ranges: String, output: String) -> Result<usize, String> {
    use tauri::Manager;
    let in_path = resolve_single_path(&input);
    let out_path = PathBuf::from(&output);

    if in_path == out_path {
        return Err("Target output file cannot be the same as input file. A new file must be created.".into());
    }

    if let Some(parent) = out_path.parent() {
        if !parent.exists() {
            let _ = std::fs::create_dir_all(parent);
        }
    }

    let temp_dir = app.path().app_cache_dir().unwrap_or_else(|_| std::env::temp_dir());
    let ctx = JobContext::new_noop(temp_dir);

    let total = PaperFlowEngine::get_page_count(&in_path).map_err(|e| e.to_string())?;
    let pages = PaperFlowEngine::parse_page_ranges(&ranges, total).map_err(|e| e.to_string())?;

    PaperFlowEngine::split_range(&in_path, &pages, &out_path, &ctx).map_err(|e| e.to_string())
}

#[tauri::command]
fn pdf_rotate(input: String, page: Option<u32>, delta: i64, output: String) -> Result<(), String> {
    let in_path = resolve_single_path(&input);
    let out_path = PathBuf::from(&output);

    if in_path == out_path {
        return Err("Target output file cannot be the same as input file. A new file must be created.".into());
    }

    if let Some(parent) = out_path.parent() {
        if !parent.exists() {
            let _ = std::fs::create_dir_all(parent);
        }
    }

    if let Some(p) = page {
        PaperFlowEngine::rotate_page(&in_path, p, delta, &out_path).map_err(|e| e.to_string())
    } else {
        PaperFlowEngine::rotate_all_pages(&in_path, delta, &out_path).map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn pdf_rotate_all(input: String, angle: i64, output: String) -> Result<(), String> {
    pdf_rotate(input, None, angle, output)
}

#[tauri::command]
fn pdf_rotate_page(input: String, page: u32, angle: i64, output: String) -> Result<(), String> {
    pdf_rotate(input, Some(page), angle, output)
}

#[tauri::command]
fn pdf_compress(app: tauri::AppHandle, input: String, preset: String, output: String) -> Result<CompressDetails, String> {
    use tauri::Manager;
    let in_path = resolve_single_path(&input);
    let out_path = PathBuf::from(&output);

    if in_path == out_path {
        return Err("Target output file cannot be the same as input file. A new file must be created.".into());
    }

    if let Some(parent) = out_path.parent() {
        if !parent.exists() {
            let _ = std::fs::create_dir_all(parent);
        }
    }

    let temp_dir = app.path().app_cache_dir().unwrap_or_else(|_| std::env::temp_dir());
    let ctx = JobContext::new_noop(temp_dir);

    let p = match preset.to_lowercase().as_str() {
        "extreme" => CompressionPreset::Extreme,
        "high" | "highquality" => CompressionPreset::HighQuality,
        _ => CompressionPreset::Recommended,
    };

    let (original_size, compressed_size) =
        Compressor::compress_file(&in_path, &out_path, p, &ctx).map_err(|e| e.to_string())?;

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
    let input_paths: Vec<PathBuf> = inputs.iter().map(|s| resolve_single_path(s)).collect();
    let out_path = PathBuf::from(&output);

    if let Some(parent) = out_path.parent() {
        if !parent.exists() {
            let _ = std::fs::create_dir_all(parent);
        }
    }

    ImageConverter::image_to_pdf(&input_paths, &out_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn pdf_sanitize_meta(input: String, output: String) -> Result<(), String> {
    let in_path = resolve_single_path(&input);
    let out_path = PathBuf::from(&output);

    if in_path == out_path {
        return Err("Target output file cannot be the same as input file. A new file must be created.".into());
    }

    if let Some(parent) = out_path.parent() {
        if !parent.exists() {
            let _ = std::fs::create_dir_all(parent);
        }
    }

    DocumentMetadata::sanitize_and_save(&in_path, &out_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_metadata(input: String) -> Result<DocumentMetadata, String> {
    let in_path = resolve_single_path(&input);
    DocumentMetadata::read_from_file(&in_path).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_doc_details,
            pdf_info,
            get_default_output_dir,
            ensure_output_dir,
            cache_uploaded_file,
            share_file,
            open_folder,
            open_file,
            delete_file,
            list_output_files,
            pdf_merge,
            pdf_split,
            pdf_rotate,
            pdf_rotate_all,
            pdf_rotate_page,
            pdf_compress,
            pdf_img2pdf,
            pdf_sanitize_meta,
            get_metadata,
            read_file_binary,
            write_file_binary,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
