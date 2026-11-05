use std::path::PathBuf;
use paperflow_core::watermark::{PageNumberOptions, PageNumberPosition, WatermarkOptions, Watermarker};
use paperflow_core::PaperFlowEngine;

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
fn test_watermark_and_page_numbers() {
    let temp_dir = std::env::temp_dir();
    let original = temp_dir.join("pf_test_original.pdf");
    let watermarked = temp_dir.join("pf_test_watermarked.pdf");
    let numbered = temp_dir.join("pf_test_numbered.pdf");

    generate_valid_pdf(&original, 3);

    // 1. Watermark
    let wm_opts = WatermarkOptions {
        text: "CONFIDENTIAL DRAFT".into(),
        font_size: 36.0,
        opacity: 0.25,
        rotation_degrees: 45.0,
        color_rgb: (0.8, 0.2, 0.2),
    };
    let pages_count = Watermarker::apply_text_watermark(&original, &watermarked, &wm_opts)
        .expect("Failed to apply watermark");
    assert_eq!(pages_count, 3);
    assert!(watermarked.exists());

    // Verify it still parses as a valid PDF
    let verified_count = PaperFlowEngine::get_page_count(&watermarked)
        .expect("Failed to parse watermarked PDF");
    assert_eq!(verified_count, 3);

    // 2. Page numbers
    let num_opts = PageNumberOptions {
        format: "Page {page} of {total}".into(),
        position: PageNumberPosition::BottomCenter,
        font_size: 11.0,
        margin: 28.0,
        start_page: 1,
        color_rgb: (0.2, 0.2, 0.2),
    };
    let numbered_count = Watermarker::apply_page_numbers(&watermarked, &numbered, &num_opts)
        .expect("Failed to apply page numbers");
    assert_eq!(numbered_count, 3);
    assert!(numbered.exists());

    let final_count = PaperFlowEngine::get_page_count(&numbered)
        .expect("Failed to parse numbered PDF");
    assert_eq!(final_count, 3);
}
