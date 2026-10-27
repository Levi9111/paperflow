use std::path::{Path, PathBuf};
use lopdf::{Document, Object, Stream};
use crate::CoreError;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PageSize {
    FitImage,
    A4,
    Letter,
}

pub struct ImageConverter;

impl ImageConverter {
    pub fn image_to_pdf(image_paths: &[PathBuf], output: &Path) -> Result<usize, CoreError> {
        Self::image_to_pdf_with_size(image_paths, output, PageSize::FitImage)
    }

    pub fn image_to_pdf_with_size(
        image_paths: &[PathBuf],
        output: &Path,
        page_size: PageSize,
    ) -> Result<usize, CoreError> {
        if image_paths.is_empty() {
            return Err(CoreError::EmptyDocument);
        }

        let mut doc = Document::with_version("1.7");
        let pages_id = (2, 0);
        let mut page_kids = Vec::new();
        let mut max_id = 3;

        for img_path in image_paths {
            let img_bytes = std::fs::read(img_path)?;
            let decoded = image::load_from_memory(&img_bytes)
                .map_err(|e| CoreError::OperationFailed(format!("Failed to decode image: {}", e)))?;

            let img_w = decoded.width() as f64;
            let img_h = decoded.height() as f64;

            let (box_w, box_h) = match page_size {
                PageSize::A4 => (595.28, 841.89),
                PageSize::Letter => (612.0, 792.0),
                PageSize::FitImage => (img_w, img_h),
            };

            let img_obj_id = (max_id, 0);
            max_id += 1;

            let mut img_dict = lopdf::Dictionary::new();
            img_dict.set("Type", Object::Name(b"XObject".to_vec()));
            img_dict.set("Subtype", Object::Name(b"Image".to_vec()));
            img_dict.set("Width", Object::Integer(decoded.width() as i64));
            img_dict.set("Height", Object::Integer(decoded.height() as i64));
            img_dict.set("ColorSpace", Object::Name(b"DeviceRGB".to_vec()));
            img_dict.set("BitsPerComponent", Object::Integer(8));

            let rgb_bytes = decoded.to_rgb8().into_raw();
            let img_stream = Stream::new(img_dict, rgb_bytes);
            doc.objects.insert(img_obj_id, Object::Stream(img_stream));

            let page_id = (max_id, 0);
            max_id += 1;

            let mut page_dict = lopdf::Dictionary::new();
            page_dict.set("Type", Object::Name(b"Page".to_vec()));
            page_dict.set("Parent", Object::Reference(pages_id));
            page_dict.set("MediaBox", Object::Array(vec![0.into(), 0.into(), box_w.into(), box_h.into()]));

            let mut xobject_dict = lopdf::Dictionary::new();
            xobject_dict.set("Im1", Object::Reference(img_obj_id));

            let mut res_dict = lopdf::Dictionary::new();
            res_dict.set("XObject", Object::Dictionary(xobject_dict));
            page_dict.set("Resources", Object::Dictionary(res_dict));

            doc.objects.insert(page_id, Object::Dictionary(page_dict));
            page_kids.push(Object::Reference(page_id));
        }

        let mut pages_dict = lopdf::Dictionary::new();
        pages_dict.set("Type", Object::Name(b"Pages".to_vec()));
        pages_dict.set("Count", Object::Integer(page_kids.len() as i64));
        pages_dict.set("Kids", Object::Array(page_kids));

        doc.objects.insert(pages_id, Object::Dictionary(pages_dict));

        let catalog_id = (1, 0);
        let mut catalog_dict = lopdf::Dictionary::new();
        catalog_dict.set("Type", Object::Name(b"Catalog".to_vec()));
        catalog_dict.set("Pages", Object::Reference(pages_id));

        doc.objects.insert(catalog_id, Object::Dictionary(catalog_dict));
        doc.trailer.set("Root", Object::Reference(catalog_id));
        doc.max_id = max_id;

        doc.save(output)?;
        Ok(image_paths.len())
    }
}
