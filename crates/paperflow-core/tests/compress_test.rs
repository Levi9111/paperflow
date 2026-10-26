use paperflow_core::compress::{Compressor, CompressionPreset};
use paperflow_core::JobContext;

#[test]
fn test_document_compression() {
    let temp_dir = std::env::temp_dir();
    let src = temp_dir.join("paperflow_compress_src.pdf");
    let out = temp_dir.join("paperflow_compress_out.pdf");

    let mut doc = lopdf::Document::with_version("1.7");
    let catalog_id = (1, 0);
    let pages_id = (2, 0);
    let mut catalog_dict = lopdf::Dictionary::new();
    catalog_dict.set("Type", lopdf::Object::Name(b"Catalog".to_vec()));
    catalog_dict.set("Pages", lopdf::Object::Reference(pages_id));
    doc.objects.insert(catalog_id, lopdf::Object::Dictionary(catalog_dict));
    doc.trailer.set("Root", lopdf::Object::Reference(catalog_id));
    doc.save(&src).expect("Save base doc");

    let ctx = JobContext::new_noop(temp_dir.clone());
    let (orig, compressed) = Compressor::compress_file(&src, &out, CompressionPreset::Recommended, &ctx)
        .expect("Compress file");

    assert!(orig > 0);
    assert!(compressed > 0);

    let _ = std::fs::remove_file(src);
    let _ = std::fs::remove_file(out);
}
