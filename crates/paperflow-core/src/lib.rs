use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use lopdf::{Document, Object};
use thiserror::Error;

pub mod metadata;
pub mod compress;
pub mod convert;

#[derive(Error, Debug)]
pub enum CoreError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("PDF parsing error: {0}")]
    Pdf(#[from] lopdf::Error),

    #[error("Invalid page range specified: {0}")]
    InvalidRange(String),

    #[error("Job cancelled by user")]
    Cancelled,

    #[error("Empty document or no pages available")]
    EmptyDocument,

    #[error("Operation failed: {0}")]
    OperationFailed(String),
}

#[derive(Clone)]
pub struct CancelToken(Arc<AtomicBool>);

impl CancelToken {
    pub fn new() -> Self {
        Self(Arc::new(AtomicBool::new(false)))
    }

    pub fn cancel(&self) {
        self.0.store(true, Ordering::SeqCst);
    }

    pub fn is_cancelled(&self) -> bool {
        self.0.load(Ordering::SeqCst)
    }
}

impl Default for CancelToken {
    fn default() -> Self {
        Self::new()
    }
}

pub struct Progress {
    pub stage: String,
    pub current: usize,
    pub total: usize,
}

pub struct JobContext {
    pub cancel: CancelToken,
    pub progress: Arc<dyn Fn(Progress) + Send + Sync>,
    pub temp_dir: PathBuf,
}

impl JobContext {
    pub fn new_noop(temp_dir: PathBuf) -> Self {
        Self {
            cancel: CancelToken::new(),
            progress: Arc::new(|_| {}),
            temp_dir,
        }
    }

    pub fn check_cancelled(&self) -> Result<(), CoreError> {
        if self.cancel.is_cancelled() {
            Err(CoreError::Cancelled)
        } else {
            Ok(())
        }
    }

    pub fn emit_progress(&self, stage: impl Into<String>, current: usize, total: usize) {
        (self.progress)(Progress {
            stage: stage.into(),
            current,
            total,
        });
    }
}

pub struct PaperFlowEngine;

impl PaperFlowEngine {
    /// Retrieve total page count from a PDF document
    pub fn get_page_count(path: &Path) -> Result<usize, CoreError> {
        let doc = Document::load(path)?;
        let pages = doc.get_pages();
        Ok(pages.len())
    }

    /// Merge multiple PDF documents into a target destination non-destructively
    pub fn merge(
        inputs: &[PathBuf],
        out_path: &Path,
        ctx: &JobContext,
    ) -> Result<usize, CoreError> {
        if inputs.is_empty() {
            return Err(CoreError::EmptyDocument);
        }

        let mut max_id = 1;
        let mut documents = Vec::new();

        ctx.emit_progress("Loading input documents", 0, inputs.len());

        for (idx, path) in inputs.iter().enumerate() {
            ctx.check_cancelled()?;
            let mut doc = Document::load(path)?;
            doc.renumber_objects_with(max_id);
            max_id = doc.max_id + 1;
            documents.push(doc);
            ctx.emit_progress("Loading input documents", idx + 1, inputs.len());
        }

        let mut merged_doc = Document::with_version("1.7");
        let mut pages_obj = BTreeMap::new();

        for (doc_idx, doc) in documents.into_iter().enumerate() {
            ctx.check_cancelled()?;
            for (obj_id, object) in doc.objects {
                match object {
                    Object::Dictionary(dict) => {
                        let is_page = dict.get(b"Type").and_then(|v| v.as_name()).map_or(false, |n| n == b"Page");
                        if is_page {
                            pages_obj.insert(obj_id, Object::Dictionary(dict));
                        } else {
                            merged_doc.objects.insert(obj_id, Object::Dictionary(dict));
                        }
                    }
                    other => {
                        merged_doc.objects.insert(obj_id, other);
                    }
                }
            }
            ctx.emit_progress("Merging document objects", doc_idx + 1, inputs.len());
        }

        let total_pages = pages_obj.len();
        if total_pages == 0 {
            return Err(CoreError::EmptyDocument);
        }

        let pages_id = (max_id, 0);
        let mut page_kids = Vec::new();

        for (id, mut object) in pages_obj {
            if let Object::Dictionary(ref mut dict) = object {
                dict.set("Parent", Object::Reference(pages_id));
            }
            merged_doc.objects.insert(id, object);
            page_kids.push(Object::Reference(id));
        }

        let mut pages_dict = lopdf::Dictionary::new();
        pages_dict.set("Type", Object::Name(b"Pages".to_vec()));
        pages_dict.set("Count", Object::Integer(page_kids.len() as i64));
        pages_dict.set("Kids", Object::Array(page_kids));

        merged_doc.objects.insert(pages_id, Object::Dictionary(pages_dict));

        let catalog_id = (max_id + 1, 0);
        let mut catalog_dict = lopdf::Dictionary::new();
        catalog_dict.set("Type", Object::Name(b"Catalog".to_vec()));
        catalog_dict.set("Pages", Object::Reference(pages_id));

        merged_doc.objects.insert(catalog_id, Object::Dictionary(catalog_dict));
        merged_doc.trailer.set("Root", Object::Reference(catalog_id));

        ctx.emit_progress("Compressing and saving merged document", total_pages, total_pages);
        merged_doc.compress();
        merged_doc.save(out_path)?;

        Ok(total_pages)
    }

    /// Parse and validate page range string (e.g., "1-3, 5, 8-10") against total pages
    pub fn parse_page_ranges(range_str: &str, total_pages: usize) -> Result<Vec<u32>, CoreError> {
        if range_str.trim().is_empty() {
            return Err(CoreError::InvalidRange("Range string is empty".into()));
        }

        let mut pages = Vec::new();
        for part in range_str.split(',') {
            let part = part.trim();
            if part.is_empty() {
                continue;
            }

            if part.contains('-') {
                let bounds: Vec<&str> = part.split('-').collect();
                if bounds.len() != 2 {
                    return Err(CoreError::InvalidRange(format!("Malformed range: {}", part)));
                }
                let start: u32 = bounds[0].trim().parse()
                    .map_err(|_| CoreError::InvalidRange(format!("Invalid start page in range: {}", part)))?;
                let end: u32 = bounds[1].trim().parse()
                    .map_err(|_| CoreError::InvalidRange(format!("Invalid end page in range: {}", part)))?;

                if start == 0 || end == 0 {
                    return Err(CoreError::InvalidRange("Page numbers must be 1-based (>= 1)".into()));
                }

                let (low, high) = if start <= end { (start, end) } else { (end, start) };
                for p in low..=high {
                    if (p as usize) <= total_pages {
                        pages.push(p);
                    }
                }
            } else {
                let page: u32 = part.parse()
                    .map_err(|_| CoreError::InvalidRange(format!("Invalid page number: {}", part)))?;
                if page == 0 {
                    return Err(CoreError::InvalidRange("Page numbers must be 1-based (>= 1)".into()));
                }
                if (page as usize) <= total_pages {
                    pages.push(page);
                }
            }
        }

        pages.sort();
        pages.dedup();

        if pages.is_empty() {
            return Err(CoreError::InvalidRange("No valid pages found in specified range".into()));
        }

        Ok(pages)
    }

    /// Split a document by page indices (1-based), writing to out_path
    pub fn split_range(
        input: &Path,
        pages_to_keep: &[u32],
        out_path: &Path,
        ctx: &JobContext,
    ) -> Result<usize, CoreError> {
        let doc = Document::load(input)?;
        let all_pages = doc.get_pages();

        let mut split_doc = Document::with_version("1.7");
        let mut max_id = 1;

        // Copy all non-page, non-catalog, non-pages objects
        for (&id, obj) in &doc.objects {
            if id.0 >= max_id {
                max_id = id.0 + 1;
            }
            split_doc.objects.insert(id, obj.clone());
        }

        let pages_id = (max_id, 0);
        let mut page_kids = Vec::new();

        for &page_num in pages_to_keep {
            ctx.check_cancelled()?;
            if let Some(&page_id) = all_pages.get(&page_num) {
                if let Ok(mut page_obj) = doc.get_object(page_id).cloned() {
                    if let Object::Dictionary(ref mut dict) = page_obj {
                        dict.set("Parent", Object::Reference(pages_id));
                    }
                    split_doc.objects.insert(page_id, page_obj);
                    page_kids.push(Object::Reference(page_id));
                }
            }
        }

        if page_kids.is_empty() {
            return Err(CoreError::InvalidRange("No matching pages found to extract".into()));
        }

        let mut pages_dict = lopdf::Dictionary::new();
        pages_dict.set("Type", Object::Name(b"Pages".to_vec()));
        pages_dict.set("Count", Object::Integer(page_kids.len() as i64));
        pages_dict.set("Kids", Object::Array(page_kids));
        split_doc.objects.insert(pages_id, Object::Dictionary(pages_dict));

        let catalog_id = (max_id + 1, 0);
        let mut catalog_dict = lopdf::Dictionary::new();
        catalog_dict.set("Type", Object::Name(b"Catalog".to_vec()));
        catalog_dict.set("Pages", Object::Reference(pages_id));
        split_doc.objects.insert(catalog_id, Object::Dictionary(catalog_dict));
        split_doc.trailer.set("Root", Object::Reference(catalog_id));

        ctx.emit_progress("Saving split document", 1, 1);
        split_doc.compress();
        split_doc.save(out_path)?;

        Ok(pages_to_keep.len())
    }

    /// Rotate specific pages (angle: 90, 180, 270)
    pub fn rotate_page(
        input: &Path,
        page_num: u32,
        rotation_delta: i64,
        out_path: &Path,
    ) -> Result<(), CoreError> {
        let mut doc = Document::load(input)?;
        let pages = doc.get_pages();

        if let Some(&page_id) = pages.get(&page_num) {
            if let Ok(page_dict) = doc.get_dictionary_mut(page_id) {
                let current_rot = page_dict
                    .get(b"Rotate")
                    .and_then(|r| r.as_i64())
                    .unwrap_or(0);
                let new_rot = (current_rot + rotation_delta) % 360;
                page_dict.set("Rotate", Object::Integer(new_rot));
            }
        } else {
            return Err(CoreError::InvalidRange(format!("Page {} not found", page_num)));
        }

        doc.save(out_path)?;
        Ok(())
    }

    /// Rotate all pages in a document (angle: 90, 180, 270)
    pub fn rotate_all_pages(
        input: &Path,
        rotation_delta: i64,
        out_path: &Path,
    ) -> Result<(), CoreError> {
        let mut doc = Document::load(input)?;
        let pages = doc.get_pages();

        for (&_page_num, &page_id) in &pages {
            if let Ok(page_dict) = doc.get_dictionary_mut(page_id) {
                let current_rot = page_dict
                    .get(b"Rotate")
                    .and_then(|r| r.as_i64())
                    .unwrap_or(0);
                let new_rot = (current_rot + rotation_delta) % 360;
                page_dict.set("Rotate", Object::Integer(new_rot));
            }
        }

        doc.save(out_path)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cancel_token() {
        let token = CancelToken::new();
        assert!(!token.is_cancelled());
        token.cancel();
        assert!(token.is_cancelled());
    }
}
