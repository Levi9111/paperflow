use std::path::PathBuf;
use paperflow_core::{JobContext, PaperFlowEngine};

fn generate_valid_pdf(path: &PathBuf, pages: usize) {
    let mut content = format!("%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n").into_bytes();
    
    let kids: Vec<String> = (0..pages).map(|i| format!("{} 0 R", i + 3)).collect();
    let pages_str = format!("2 0 obj\n<< /Type /Pages /Kids [{}] /Count {} >>\nendobj\n", kids.join(" "), pages);
    content.extend_from_slice(pages_str.as_bytes());

    for i in 0..pages {
        let page_num = i + 1;
        let page_obj = format!(
            "{} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents {} 0 R >>\nendobj\n",
            page_num + 2,
            pages + 3 + i
        );
        content.extend_from_slice(page_obj.as_bytes());
    }

    for i in 0..pages {
        let stream = format!("BT /F1 24 Tf 100 700 Td (Page {}) Tj ET", i + 1);
        let stream_obj = format!(
            "{} 0 obj\n<< /Length {} >>\nstream\n{}\nendstream\nendobj\n",
            pages + 3 + i,
            stream.len(),
            stream
        );
        content.extend_from_slice(stream_obj.as_bytes());
    }

    content.extend_from_slice(b"xref\n0 1\n0000000000 65535 f \ntrailer\n<< /Size 20 /Root 1 0 R >>\nstartxref\n10\n%%EOF");
    std::fs::write(path, content).expect("Failed to write test PDF");
}

#[test]
fn test_corpus_merge_and_split() {
    let temp_dir = std::env::temp_dir();
    let doc_a = temp_dir.join("paperflow_corpus_a.pdf");
    let doc_b = temp_dir.join("paperflow_corpus_b.pdf");
    let merged = temp_dir.join("paperflow_corpus_merged.pdf");
    let split = temp_dir.join("paperflow_corpus_split.pdf");

    generate_valid_pdf(&doc_a, 2);
    generate_valid_pdf(&doc_b, 3);

    let ctx = JobContext::new_noop(temp_dir.clone());

    // 1. Verify page counts
    let count_a = PaperFlowEngine::get_page_count(&doc_a).expect("Count doc A");
    let count_b = PaperFlowEngine::get_page_count(&doc_b).expect("Count doc B");
    assert_eq!(count_a, 2);
    assert_eq!(count_b, 3);

    // 2. Merge docs A and B
    let merged_count = PaperFlowEngine::merge(&[doc_a.clone(), doc_b.clone()], &merged, &ctx).expect("Merge failed");
    assert_eq!(merged_count, 5);

    let verified_merged_count = PaperFlowEngine::get_page_count(&merged).expect("Count merged");
    assert_eq!(verified_merged_count, 5);

    // 3. Rotate page 1
    let rotated = temp_dir.join("paperflow_corpus_rotated.pdf");
    PaperFlowEngine::rotate_page(&merged, 1, 90, &rotated).expect("Rotate failed");
    let rotated_count = PaperFlowEngine::get_page_count(&rotated).expect("Count rotated");
    assert_eq!(rotated_count, 5);

    // 4. Split: extract pages 1 and 3
    let split_count = PaperFlowEngine::split_range(&merged, &[1, 3], &split, &ctx).expect("Split failed");
    assert_eq!(split_count, 2);

    let verified_split_count = PaperFlowEngine::get_page_count(&split).expect("Count split");
    assert_eq!(verified_split_count, 2);

    // Clean up
    let _ = std::fs::remove_file(doc_a);
    let _ = std::fs::remove_file(doc_b);
    let _ = std::fs::remove_file(merged);
    let _ = std::fs::remove_file(rotated);
    let _ = std::fs::remove_file(split);
}
