use paperflow_core::metadata::DocumentMetadata;

#[test]
fn test_metadata_extraction_and_sanitization() {
    let temp_dir = std::env::temp_dir();
    let src = temp_dir.join("paperflow_meta_src.pdf");
    let sanitized = temp_dir.join("paperflow_meta_clean.pdf");
    let updated = temp_dir.join("paperflow_meta_updated.pdf");

    // Create base PDF
    let mut doc = lopdf::Document::with_version("1.7");
    let catalog_id = (1, 0);
    let pages_id = (2, 0);
    let mut catalog_dict = lopdf::Dictionary::new();
    catalog_dict.set("Type", lopdf::Object::Name(b"Catalog".to_vec()));
    catalog_dict.set("Pages", lopdf::Object::Reference(pages_id));
    doc.objects.insert(catalog_id, lopdf::Object::Dictionary(catalog_dict));
    doc.trailer.set("Root", lopdf::Object::Reference(catalog_id));
    doc.save(&src).expect("Save base doc");

    // Write metadata
    let mut initial_meta = DocumentMetadata::default();
    initial_meta.title = Some("Confidential Quarterly Report".into());
    initial_meta.author = Some("Internal Auditor".into());
    DocumentMetadata::write_to_document(&src, &initial_meta, &updated).expect("Write metadata");

    // Read and verify
    let read_meta = DocumentMetadata::read_from_file(&updated).expect("Read metadata");
    assert_eq!(read_meta.title.as_deref(), Some("Confidential Quarterly Report"));
    assert_eq!(read_meta.author.as_deref(), Some("Internal Auditor"));

    // Sanitize (strip all metadata)
    DocumentMetadata::sanitize_and_save(&updated, &sanitized).expect("Sanitize metadata");
    let clean_meta = DocumentMetadata::read_from_file(&sanitized).expect("Read clean metadata");
    assert_eq!(clean_meta.title, None);
    assert_eq!(clean_meta.author, None);

    let _ = std::fs::remove_file(src);
    let _ = std::fs::remove_file(sanitized);
    let _ = std::fs::remove_file(updated);
}
