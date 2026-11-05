use std::path::Path;
use lopdf::{Document, Object, Stream, Dictionary};
use crate::CoreError;

#[derive(Debug, Clone)]
pub struct WatermarkOptions {
    pub text: String,
    pub font_size: f64,
    pub opacity: f64,
    pub rotation_degrees: f64,
    pub color_rgb: (f64, f64, f64),
}

impl Default for WatermarkOptions {
    fn default() -> Self {
        Self {
            text: "CONFIDENTIAL".to_string(),
            font_size: 48.0,
            opacity: 0.3,
            rotation_degrees: 45.0,
            color_rgb: (0.7, 0.7, 0.7),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PageNumberPosition {
    TopLeft,
    TopCenter,
    TopRight,
    BottomLeft,
    BottomCenter,
    BottomRight,
}

#[derive(Debug, Clone)]
pub struct PageNumberOptions {
    pub format: String, // e.g. "Page {page} of {total}" or "{page}"
    pub position: PageNumberPosition,
    pub font_size: f64,
    pub margin: f64,
    pub start_page: usize,
    pub color_rgb: (f64, f64, f64),
}

impl Default for PageNumberOptions {
    fn default() -> Self {
        Self {
            format: "Page {page} of {total}".to_string(),
            position: PageNumberPosition::BottomCenter,
            font_size: 10.0,
            margin: 30.0,
            start_page: 1,
            color_rgb: (0.3, 0.3, 0.3),
        }
    }
}

pub struct Watermarker;

fn object_to_f64(obj: &Object) -> Option<f64> {
    match obj {
        Object::Real(f) => Some(*f as f64),
        Object::Integer(i) => Some(*i as f64),
        _ => None,
    }
}

fn escape_pdf_string(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 8);
    for c in s.chars() {
        match c {
            '(' => out.push_str("\\("),
            ')' => out.push_str("\\)"),
            '\\' => out.push_str("\\\\"),
            _ => out.push(c),
        }
    }
    out
}

impl Watermarker {
    /// Apply diagonal or horizontal text watermark across document pages
    pub fn apply_text_watermark(
        input: &Path,
        output: &Path,
        options: &WatermarkOptions,
    ) -> Result<usize, CoreError> {
        let mut doc = Document::load(input)?;
        let pages = doc.get_pages();
        let total_pages = pages.len();
        if total_pages == 0 {
            return Err(CoreError::EmptyDocument);
        }

        // Shared font & ExtGState objects
        let font_id = (doc.max_id + 1, 0);
        let mut font_dict = Dictionary::new();
        font_dict.set("Type", Object::Name(b"Font".to_vec()));
        font_dict.set("Subtype", Object::Name(b"Type1".to_vec()));
        font_dict.set("BaseFont", Object::Name(b"Helvetica-Bold".to_vec()));
        doc.objects.insert(font_id, Object::Dictionary(font_dict));

        let gs_id = (doc.max_id + 2, 0);
        let mut gs_dict = Dictionary::new();
        gs_dict.set("Type", Object::Name(b"ExtGState".to_vec()));
        let op = options.opacity.clamp(0.05, 1.0) as f32;
        gs_dict.set("ca", Object::Real(op));
        gs_dict.set("CA", Object::Real(op));
        doc.objects.insert(gs_id, Object::Dictionary(gs_dict));

        doc.max_id += 2;

        let rad = options.rotation_degrees.to_radians();
        let cos_a = rad.cos();
        let sin_a = rad.sin();
        let escaped = escape_pdf_string(&options.text);
        let (r, g, b) = options.color_rgb;

        for (_page_num, &page_id) in &pages {
            // Retrieve page dimensions (MediaBox)
            let (page_w, page_h) = {
                let p_dict = doc.get_dictionary(page_id)?;
                if let Ok(mb) = p_dict.get(b"MediaBox").and_then(Object::as_array) {
                    let w = mb.get(2).and_then(object_to_f64).unwrap_or(595.28);
                    let h = mb.get(3).and_then(object_to_f64).unwrap_or(841.89);
                    (w, h)
                } else {
                    (595.28, 841.89)
                }
            };

            // Estimate text width (rough Helvetica bold average width ~0.6 * font_size)
            let est_w = options.text.len() as f64 * options.font_size * 0.55;
            let center_x = page_w / 2.0;
            let center_y = page_h / 2.0;

            // Content stream for watermark
            let content_str = format!(
                "q\n/GS_PF gs\n/F_PF {} Tf\n{:.3} {:.3} {:.3} rg\n1 0 0 1 {:.2} {:.2} cm\n{:.4} {:.4} {:.4} {:.4} 0 0 cm\nBT\n{:.2} {:.2} Td\n({}) Tj\nET\nQ\n",
                options.font_size,
                r, g, b,
                center_x, center_y,
                cos_a, sin_a, -sin_a, cos_a,
                -est_w / 2.0, -options.font_size / 3.0,
                escaped
            );

            let stream_id = (doc.max_id + 1, 0);
            doc.max_id += 1;
            let stream = Stream::new(Dictionary::new(), content_str.into_bytes());
            doc.objects.insert(stream_id, Object::Stream(stream));

            // Attach resources & stream to page
            let page_dict = doc.get_dictionary_mut(page_id)?;

            // 1. Update Resources
            let mut res_dict = page_dict
                .get(b"Resources")
                .and_then(Object::as_dict)
                .cloned()
                .unwrap_or_default();

            // Add Font
            let mut fonts = res_dict
                .get(b"Font")
                .and_then(Object::as_dict)
                .cloned()
                .unwrap_or_default();
            fonts.set("F_PF", Object::Reference(font_id));
            res_dict.set("Font", Object::Dictionary(fonts));

            // Add ExtGState
            let mut extg = res_dict
                .get(b"ExtGState")
                .and_then(Object::as_dict)
                .cloned()
                .unwrap_or_default();
            extg.set("GS_PF", Object::Reference(gs_id));
            res_dict.set("ExtGState", Object::Dictionary(extg));

            page_dict.set("Resources", Object::Dictionary(res_dict));

            // 2. Append stream to Contents
            match page_dict.get_mut(b"Contents") {
                Ok(Object::Array(ref mut arr)) => {
                    arr.push(Object::Reference(stream_id));
                }
                Ok(Object::Reference(orig_ref)) => {
                    let old_id = *orig_ref;
                    page_dict.set("Contents", Object::Array(vec![Object::Reference(old_id), Object::Reference(stream_id)]));
                }
                _ => {
                    page_dict.set("Contents", Object::Reference(stream_id));
                }
            }
        }

        doc.save(output)?;
        Ok(total_pages)
    }

    /// Apply page numbering or Bates numbering to document
    pub fn apply_page_numbers(
        input: &Path,
        output: &Path,
        options: &PageNumberOptions,
    ) -> Result<usize, CoreError> {
        let mut doc = Document::load(input)?;
        let pages = doc.get_pages();
        let total_pages = pages.len();
        if total_pages == 0 {
            return Err(CoreError::EmptyDocument);
        }

        // Shared font
        let font_id = (doc.max_id + 1, 0);
        let mut font_dict = Dictionary::new();
        font_dict.set("Type", Object::Name(b"Font".to_vec()));
        font_dict.set("Subtype", Object::Name(b"Type1".to_vec()));
        font_dict.set("BaseFont", Object::Name(b"Helvetica".to_vec()));
        doc.objects.insert(font_id, Object::Dictionary(font_dict));
        doc.max_id += 1;

        let (r, g, b) = options.color_rgb;

        for (&page_num, &page_id) in &pages {
            if (page_num as usize) < options.start_page {
                continue;
            }

            let text_val = options
                .format
                .replace("{page}", &page_num.to_string())
                .replace("{total}", &total_pages.to_string());

            let escaped = escape_pdf_string(&text_val);

            // Retrieve page dimensions (MediaBox)
            let (page_w, page_h) = {
                let p_dict = doc.get_dictionary(page_id)?;
                if let Ok(mb) = p_dict.get(b"MediaBox").and_then(Object::as_array) {
                    let w = mb.get(2).and_then(object_to_f64).unwrap_or(595.28);
                    let h = mb.get(3).and_then(object_to_f64).unwrap_or(841.89);
                    (w, h)
                } else {
                    (595.28, 841.89)
                }
            };

            let est_w = text_val.len() as f64 * options.font_size * 0.52;
            let m = options.margin;

            let (pos_x, pos_y) = match options.position {
                PageNumberPosition::TopLeft => (m, page_h - m - options.font_size),
                PageNumberPosition::TopCenter => (page_w / 2.0 - est_w / 2.0, page_h - m - options.font_size),
                PageNumberPosition::TopRight => (page_w - m - est_w, page_h - m - options.font_size),
                PageNumberPosition::BottomLeft => (m, m),
                PageNumberPosition::BottomCenter => (page_w / 2.0 - est_w / 2.0, m),
                PageNumberPosition::BottomRight => (page_w - m - est_w, m),
            };

            let content_str = format!(
                "q\n/F_NUM {} Tf\n{:.3} {:.3} {:.3} rg\nBT\n{:.2} {:.2} Td\n({}) Tj\nET\nQ\n",
                options.font_size,
                r, g, b,
                pos_x, pos_y,
                escaped
            );

            let stream_id = (doc.max_id + 1, 0);
            doc.max_id += 1;
            let stream = Stream::new(Dictionary::new(), content_str.into_bytes());
            doc.objects.insert(stream_id, Object::Stream(stream));

            // Attach resources & stream to page
            let page_dict = doc.get_dictionary_mut(page_id)?;

            let mut res_dict = page_dict
                .get(b"Resources")
                .and_then(Object::as_dict)
                .cloned()
                .unwrap_or_default();

            let mut fonts = res_dict
                .get(b"Font")
                .and_then(Object::as_dict)
                .cloned()
                .unwrap_or_default();
            fonts.set("F_NUM", Object::Reference(font_id));
            res_dict.set("Font", Object::Dictionary(fonts));
            page_dict.set("Resources", Object::Dictionary(res_dict));

            match page_dict.get_mut(b"Contents") {
                Ok(Object::Array(ref mut arr)) => {
                    arr.push(Object::Reference(stream_id));
                }
                Ok(Object::Reference(orig_ref)) => {
                    let old_id = *orig_ref;
                    page_dict.set("Contents", Object::Array(vec![Object::Reference(old_id), Object::Reference(stream_id)]));
                }
                _ => {
                    page_dict.set("Contents", Object::Reference(stream_id));
                }
            }
        }

        doc.save(output)?;
        Ok(total_pages)
    }
}
