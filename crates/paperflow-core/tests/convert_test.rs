use image::{ImageBuffer, Rgb};
use paperflow_core::convert::ImageConverter;
use paperflow_core::PaperFlowEngine;

#[test]
fn test_image_to_pdf_conversion() {
    let temp_dir = std::env::temp_dir();
    let img_path = temp_dir.join("paperflow_test_img.png");
    let pdf_out = temp_dir.join("paperflow_from_img.pdf");

    // Create 100x100 test image
    let img: ImageBuffer<Rgb<u8>, Vec<u8>> = ImageBuffer::from_pixel(100, 100, Rgb([255, 71, 87]));
    img.save(&img_path).expect("Save test png");

    let count = ImageConverter::image_to_pdf(&[img_path.clone()], &pdf_out)
        .expect("Convert image to pdf");
    assert_eq!(count, 1);

    let verified_pages = PaperFlowEngine::get_page_count(&pdf_out)
        .expect("Count pages in generated PDF");
    assert_eq!(verified_pages, 1);

    let _ = std::fs::remove_file(img_path);
    let _ = std::fs::remove_file(pdf_out);
}
