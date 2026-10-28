import React, { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { invoke } from "@tauri-apps/api/core";
import { isTauriEnvironment } from "../utils/platform";
import { formatBytes } from "../utils/format";
import { ToolType } from "../types/pdf";

// Configure worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface PdfViewerProps {
  filePath?: string | null;
  onClose?: () => void;
  onNavigateToTool?: (tool: ToolType, targetFilePath?: string) => void;
  onSelectFile?: () => void;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({
  filePath,
  onClose,
  onNavigateToTool,
  onSelectFile,
}) => {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [fitMode, setFitMode] = useState<"custom" | "width" | "page">("width");
  const [rotation, setRotation] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number>(0);
  const [viewMode, setViewMode] = useState<"continuous" | "single">("continuous");
  const [showThumbnails, setShowThumbnails] = useState<boolean>(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const pagesContainerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<{ [key: number]: HTMLCanvasElement | null }>({});
  const thumbRefs = useRef<{ [key: number]: HTMLCanvasElement | null }>({});

  const filename = filePath ? filePath.split(/[/\\]/).pop() || "Document.pdf" : "Document.pdf";

  // Load document
  useEffect(() => {
    let isCancelled = false;

    async function loadPdf() {
      if (!filePath) {
        setPdfDoc(null);
        setNumPages(0);
        return;
      }

      setIsLoading(true);
      setErrorMsg(null);

      try {
        let data: Uint8Array;
        if (isTauriEnvironment()) {
          const rawBytes: number[] = await invoke("read_file_binary", { path: filePath });
          data = new Uint8Array(rawBytes);
          setFileSize(data.byteLength);
        } else {
          // Browser fetch
          const res = await fetch(filePath);
          const buf = await res.arrayBuffer();
          data = new Uint8Array(buf);
          setFileSize(data.byteLength);
        }

        const loadingTask = pdfjsLib.getDocument({ data });
        const loadedDoc = await loadingTask.promise;

        if (!isCancelled) {
          setPdfDoc(loadedDoc);
          setNumPages(loadedDoc.numPages);
          setCurrentPage(1);
          setIsLoading(false);
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error("Failed to load PDF:", err);
          setErrorMsg(err?.message || "Failed to load and render PDF document.");
          setIsLoading(false);
        }
      }
    }

    loadPdf();

    return () => {
      isCancelled = true;
    };
  }, [filePath]);

  // Render a specific page
  const renderPage = useCallback(
    async (pageIndex: number, canvas: HTMLCanvasElement, targetScale: number, rot: number) => {
      if (!pdfDoc) return;
      try {
        const page = await pdfDoc.getPage(pageIndex);
        const viewport = page.getViewport({ scale: targetScale, rotation: rot });

        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const renderContext = {
          canvas: canvas,
          canvasContext: ctx,
          viewport: viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
        };

        await page.render(renderContext).promise;
      } catch (e: any) {
        // Render cancellations can happen when resizing/changing scale rapidly
        if (e?.name !== "RenderingCancelledException") {
          console.warn(`Render error on page ${pageIndex}:`, e);
        }
      }
    },
    [pdfDoc]
  );

  // Render thumbnails
  useEffect(() => {
    if (!pdfDoc || !showThumbnails) return;

    for (let p = 1; p <= numPages; p++) {
      const thumbCanvas = thumbRefs.current[p];
      if (thumbCanvas) {
        renderPage(p, thumbCanvas, 0.2, rotation);
      }
    }
  }, [pdfDoc, numPages, showThumbnails, rotation, renderPage]);

  // Render main viewport pages
  useEffect(() => {
    if (!pdfDoc) return;

    if (viewMode === "single") {
      const canvas = canvasRefs.current[currentPage];
      if (canvas) {
        renderPage(currentPage, canvas, scale, rotation);
      }
    } else {
      for (let p = 1; p <= numPages; p++) {
        const canvas = canvasRefs.current[p];
        if (canvas) {
          renderPage(p, canvas, scale, rotation);
        }
      }
    }
  }, [pdfDoc, numPages, currentPage, scale, rotation, viewMode, renderPage]);

  // Handle Zoom In / Out
  const handleZoomIn = () => {
    setFitMode("custom");
    setScale((prev) => Math.min(prev + 0.25, 3.0));
  };

  const handleZoomOut = () => {
    setFitMode("custom");
    setScale((prev) => Math.max(prev - 0.25, 0.4));
  };

  const handleFitWidth = async () => {
    if (!pdfDoc || !containerRef.current) return;
    try {
      const page = await pdfDoc.getPage(currentPage);
      const unscaledViewport = page.getViewport({ scale: 1.0, rotation });
      const availableWidth = containerRef.current.clientWidth - (showThumbnails ? 220 : 60);
      const newScale = Math.max(0.4, Math.min(availableWidth / unscaledViewport.width, 2.5));
      setScale(parseFloat(newScale.toFixed(2)));
      setFitMode("width");
    } catch (e) {
      console.warn("Fit width error:", e);
    }
  };

  const handleFitPage = async () => {
    if (!pdfDoc || !containerRef.current) return;
    try {
      const page = await pdfDoc.getPage(currentPage);
      const unscaledViewport = page.getViewport({ scale: 1.0, rotation });
      const availableHeight = containerRef.current.clientHeight - 100;
      const newScale = Math.max(0.4, Math.min(availableHeight / unscaledViewport.height, 2.0));
      setScale(parseFloat(newScale.toFixed(2)));
      setFitMode("page");
    } catch (e) {
      console.warn("Fit page error:", e);
    }
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleScrollToPage = (pageNum: number) => {
    setCurrentPage(pageNum);
    if (viewMode === "continuous") {
      const targetCanvas = canvasRefs.current[pageNum];
      if (targetCanvas) {
        targetCanvas.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  const handleOpenExternal = async () => {
    if (!filePath) return;
    if (isTauriEnvironment()) {
      try {
        await invoke("open_file", { path: filePath });
      } catch (err) {
        console.warn("External open error:", err);
      }
    } else {
      window.open(filePath, "_blank");
    }
  };

  return (
    <div className="pdf-viewer-overlay" ref={containerRef}>
      {/* Top Floating Fluent Command Bar */}
      <div className="viewer-toolbar">
        <div className="toolbar-left">
          {onClose && (
            <button className="btn-viewer-back" onClick={onClose} title="Back to Tools">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              <span>Back</span>
            </button>
          )}

          <div className="viewer-doc-info">
            <span className="doc-title" title={filePath || ""}>
              {filename}
            </span>
            {numPages > 0 && (
              <span className="doc-meta">
                {numPages} {numPages === 1 ? "page" : "pages"} {fileSize > 0 ? `• ${formatBytes(fileSize)}` : ""}
              </span>
            )}
          </div>
        </div>

        {/* Center: Zoom and Navigation */}
        <div className="toolbar-center">
          <button
            className={`btn-viewer-tool ${showThumbnails ? "active" : ""}`}
            onClick={() => setShowThumbnails(!showThumbnails)}
            title="Toggle Thumbnails Sidebar"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="18" rx="1" />
              <rect x="14" y="3" width="7" height="8" rx="1" />
              <rect x="14" y="13" width="7" height="8" rx="1" />
            </svg>
          </button>

          <div className="toolbar-sep" />

          {/* Page Jumper */}
          <div className="page-nav-controls">
            <button
              className="btn-viewer-nav"
              disabled={currentPage <= 1}
              onClick={() => handleScrollToPage(Math.max(1, currentPage - 1))}
              title="Previous Page"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <span className="page-indicator">
              Page <strong>{currentPage}</strong> of {numPages || 1}
            </span>

            <button
              className="btn-viewer-nav"
              disabled={currentPage >= numPages}
              onClick={() => handleScrollToPage(Math.min(numPages, currentPage + 1))}
              title="Next Page"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          <div className="toolbar-sep" />

          {/* Zoom Tools */}
          <div className="zoom-controls">
            <button className="btn-viewer-tool" onClick={handleZoomOut} title="Zoom Out (-)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
            </button>

            <span className="zoom-label">{Math.round(scale * 100)}%</span>

            <button className="btn-viewer-tool" onClick={handleZoomIn} title="Zoom In (+)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="11" y1="8" x2="11" y2="14" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
            </button>

            <button
              className={`btn-viewer-tool ${fitMode === "width" ? "active" : ""}`}
              onClick={handleFitWidth}
              title="Fit to Width"
            >
              Width
            </button>

            <button
              className={`btn-viewer-tool ${fitMode === "page" ? "active" : ""}`}
              onClick={handleFitPage}
              title="Fit Entire Page"
            >
              Page
            </button>
          </div>

          <div className="toolbar-sep" />

          {/* Rotation & View Mode */}
          <button className="btn-viewer-tool" onClick={handleRotate} title="Rotate View 90°">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.5 2v6h-6" />
              <path d="M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
          </button>

          <button
            className={`btn-viewer-tool ${viewMode === "continuous" ? "active" : ""}`}
            onClick={() => setViewMode(viewMode === "continuous" ? "single" : "continuous")}
            title={viewMode === "continuous" ? "Switch to Single Page" : "Switch to Continuous Scroll"}
          >
            {viewMode === "continuous" ? "Scroll" : "Single"}
          </button>
        </div>

        {/* Right: Actions */}
        <div className="toolbar-right">
          {onNavigateToTool && filePath && (
            <div className="viewer-shortcuts">
              <button
                className="btn-viewer-action"
                onClick={() => onNavigateToTool("compress", filePath)}
                title="Send to Compress"
              >
                Compress
              </button>
              <button
                className="btn-viewer-action"
                onClick={() => onNavigateToTool("split", filePath)}
                title="Send to Split"
              >
                Split
              </button>
              <button
                className="btn-viewer-action"
                onClick={() => onNavigateToTool("rotate", filePath)}
                title="Send to Rotate"
              >
                Rotate
              </button>
            </div>
          )}

          <button
            className="btn-viewer-action external"
            onClick={handleOpenExternal}
            title="Open in System Default PDF Reader"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            <span>External</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="viewer-body">
        {/* Thumbnails Sidebar */}
        {showThumbnails && numPages > 0 && (
          <aside className="viewer-thumbnails-panel">
            <div className="thumbnails-scroll-list">
              {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => (
                <div
                  key={p}
                  className={`thumbnail-item ${currentPage === p ? "active" : ""}`}
                  onClick={() => handleScrollToPage(p)}
                  title={`Jump to Page ${p}`}
                >
                  <canvas
                    ref={(el) => {
                      thumbRefs.current[p] = el;
                    }}
                    className="thumbnail-canvas"
                  />
                  <span className="thumbnail-num">{p}</span>
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* Document Canvas Viewport */}
        <div className="viewer-canvas-scroll-area" ref={pagesContainerRef}>
          {isLoading ? (
            <div className="viewer-loading-state">
              <div className="fluent-ring-spinner" />
              <p>Rendering document...</p>
            </div>
          ) : errorMsg ? (
            <div className="viewer-error-state">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <h4>Unable to Preview Document</h4>
              <p>{errorMsg}</p>
              <button className="btn-viewer-action primary" onClick={handleOpenExternal}>
                Open in System PDF Viewer
              </button>
            </div>
          ) : !filePath ? (
            <div className="viewer-no-file-state">
              <div className="no-file-icon">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </div>
              <h3>Select a PDF to View</h3>
              <p>Choose an output from Work History or select any PDF file from your device to preview inside PaperFlow.</p>
              {onSelectFile && (
                <button className="btn-viewer-action primary" onClick={onSelectFile}>
                  Choose PDF File...
                </button>
              )}
            </div>
          ) : (
            <div className="viewer-pages-stack">
              {viewMode === "single" ? (
                <div className="viewer-page-wrapper">
                  <canvas
                    ref={(el) => {
                      canvasRefs.current[currentPage] = el;
                    }}
                    className="pdf-page-canvas"
                  />
                  <div className="page-watermark-label">Page {currentPage} of {numPages}</div>
                </div>
              ) : (
                Array.from({ length: numPages }, (_, i) => i + 1).map((p) => (
                  <div key={p} className="viewer-page-wrapper" id={`viewer-page-${p}`}>
                    <canvas
                      ref={(el) => {
                        canvasRefs.current[p] = el;
                      }}
                      className="pdf-page-canvas"
                    />
                    <div className="page-watermark-label">Page {p} of {numPages}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
