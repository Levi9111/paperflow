use paperflow_core::PaperFlowEngine;

#[test]
fn test_parse_page_ranges_valid() {
    let total = 20;
    let res = PaperFlowEngine::parse_page_ranges("1-3, 5, 8-10, 15", total).unwrap();
    assert_eq!(res, vec![1, 2, 3, 5, 8, 9, 10, 15]);

    // Reverse range handling (e.g., 5-3 -> 3, 4, 5)
    let res2 = PaperFlowEngine::parse_page_ranges("5-3, 7", total).unwrap();
    assert_eq!(res2, vec![3, 4, 5, 7]);

    // Deduplication and sorting
    let res3 = PaperFlowEngine::parse_page_ranges("4, 2, 4, 1-3", total).unwrap();
    assert_eq!(res3, vec![1, 2, 3, 4]);
}

#[test]
fn test_parse_page_ranges_out_of_bounds() {
    let total = 5;
    // Pages beyond total (e.g. 10) are filtered out, keeping valid pages
    let res = PaperFlowEngine::parse_page_ranges("1-3, 10, 20", total).unwrap();
    assert_eq!(res, vec![1, 2, 3]);

    // If all are out of bounds, returns error
    let err = PaperFlowEngine::parse_page_ranges("10-15", total);
    assert!(err.is_err());
}

#[test]
fn test_parse_page_ranges_invalid_syntax() {
    let total = 10;
    assert!(PaperFlowEngine::parse_page_ranges("", total).is_err());
    assert!(PaperFlowEngine::parse_page_ranges("abc", total).is_err());
    assert!(PaperFlowEngine::parse_page_ranges("0-5", total).is_err());
}
