import React, { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { invoke } from "@tauri-apps/api/core";
import { isTauriEnvironment } from "../utils/platform";
import { formatBytes, generateDedicatedOutputPath } from "../utils/format";
import { addHistoryRecord } from "../utils/historyStore";
import { ToolType } from "../types/pdf";

// Configure worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export type EditTool = "select" | "text" | "whiteout" | "draw" | "highlight" | "signature";

export interface TextAnnotation {
  id: string;
  type: "text";
  page: number;
  x: number; // 0 to 1 percentage of page width
  y: number; // 0 to 1 percentage of page height
  text: string;
  fontSize: number;
  color: string;
  isBold?: boolean;
}

export interface WhiteoutAnnotation {
  id: string;
  type: "whiteout";
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface DrawingAnnotation {
  id: string;
  type: "drawing";
  page: number;
  points: { x: number; y: number }[];
  color: string;
  strokeWidth: number;
  isHighlight?: boolean;
}

export interface SignatureAnnotation {
  id: string;
  type: "signature";
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  dataUrl: string;
}

export type AnnotationItem =
  | TextAnnotation
  | WhiteoutAnnotation
  | DrawingAnnotation
  | SignatureAnnotation;

export interface PdfViewerProps {
  filePath?: string | null;
  outputDir?: string;
  onClose?: () => void;
  onNavigateToTool?: (tool: ToolType, targetFilePath?: string) => void;
  onSelectFile?: () => void;
  onShowToast?: (msg: string, type: "info" | "success" | "warning") => void;
  onFileSaved?: (newPath: string) => void;
}

function hexToRgb(hex: string) {
  let c = hex.replace("#", "");
  if (c.length === 3) c = c.split("").map((x) => x + x).join("");
  const num = parseInt(c, 16);
  return rgb((num >> 16) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255);
}

export const PdfViewer: React.FC<PdfViewerProps> = ({
  filePath,
  outputDir,
  onClose,
  onNavigateToTool,
  onSelectFile,
  onShowToast,
  onFileSaved,
}) => {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [rawPdfBytes, setRawPdfBytes] = useState<Uint8Array | null>(null);
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

  // Editing & Annotation States
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [activeTool, setActiveTool] = useState<EditTool>("select");
  const [selectedColor, setSelectedColor] = useState<string>("#ff4757");
  const [fontSize, setFontSize] = useState<number>(16);
  const [isBold, setIsBold] = useState<boolean>(false);
  const [annotations, setAnnotations] = useState<AnnotationItem[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[]>([]);
  const [drawingPage, setDrawingPage] = useState<number>(1);

  // Whiteout drag state
  const [whiteoutStart, setWhiteoutStart] = useState<{ x: number; y: number } | null>(null);
  const [whiteoutCurrent, setWhiteoutCurrent] = useState<{ x: number; y: number } | null>(null);

  // Signature Modal state
  const [showSigModal, setShowSigModal] = useState<boolean>(false);
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isSigning, setIsSigning] = useState<boolean>(false);

  // Page dimensions (scaled width & height for each page)
  const [pageDimensions, setPageDimensions] = useState<{ [key: number]: { width: number; height: number } }>({});

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
        setRawPdfBytes(null);
        setNumPages(0);
        setAnnotations([]);
        return;
      }

      setIsLoading(true);
      setErrorMsg(null);
      setAnnotations([]);

      try {
        let data: Uint8Array;
        if (isTauriEnvironment()) {
          const rawBytes: number[] = await invoke("read_file_binary", { path: filePath });
          data = new Uint8Array(rawBytes);
          setFileSize(data.byteLength);
          setRawPdfBytes(data);
        } else {
          const res = await fetch(filePath);
          const buf = await res.arrayBuffer();
          data = new Uint8Array(buf);
          setFileSize(data.byteLength);
          setRawPdfBytes(data);
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

        setPageDimensions((prev) => ({
          ...prev,
          [pageIndex]: { width: Math.floor(viewport.width), height: Math.floor(viewport.height) },
        }));

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
        renderPage(p, thumbCanvas, 0.18, rotation);
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
      const availableHeight = containerRef.current.clientHeight - 130;
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

  // --- ANNOTATION & EDITING HANDLERS ---

  const handleOverlayMouseDown = (e: React.MouseEvent<HTMLDivElement>, pageNum: number) => {
    if (!isEditMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    if (activeTool === "text") {
      // Create new text box at click position
      const newAnnot: TextAnnotation = {
        id: "text_" + Date.now(),
        type: "text",
        page: pageNum,
        x,
        y,
        text: "Click to edit text",
        fontSize,
        color: selectedColor,
        isBold,
      };
      setAnnotations((prev) => [...prev, newAnnot]);
    } else if (activeTool === "whiteout") {
      setWhiteoutStart({ x, y });
      setWhiteoutCurrent({ x, y });
      setDrawingPage(pageNum);
    } else if (activeTool === "draw" || activeTool === "highlight") {
      setIsDrawing(true);
      setDrawingPage(pageNum);
      setCurrentStroke([{ x, y }]);
    }
  };

  const handleOverlayMouseMove = (e: React.MouseEvent<HTMLDivElement>, pageNum: number) => {
    if (!isEditMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    if (activeTool === "whiteout" && whiteoutStart && drawingPage === pageNum) {
      setWhiteoutCurrent({ x, y });
    } else if (isDrawing && drawingPage === pageNum) {
      setCurrentStroke((prev) => [...prev, { x, y }]);
    }
  };

  const handleOverlayMouseUp = () => {
    if (!isEditMode) return;

    if (activeTool === "whiteout" && whiteoutStart && whiteoutCurrent) {
      const minX = Math.min(whiteoutStart.x, whiteoutCurrent.x);
      const minY = Math.min(whiteoutStart.y, whiteoutCurrent.y);
      const w = Math.abs(whiteoutCurrent.x - whiteoutStart.x);
      const h = Math.abs(whiteoutCurrent.y - whiteoutStart.y);

      if (w > 0.01 && h > 0.01) {
        const newWhiteout: WhiteoutAnnotation = {
          id: "whiteout_" + Date.now(),
          type: "whiteout",
          page: drawingPage,
          x: minX,
          y: minY,
          width: w,
          height: h,
          color: selectedColor === "#ffffff" ? "#ffffff" : selectedColor,
        };
        setAnnotations((prev) => [...prev, newWhiteout]);
      }
      setWhiteoutStart(null);
      setWhiteoutCurrent(null);
    } else if (isDrawing && currentStroke.length > 1) {
      const isHigh = activeTool === "highlight";
      const newDrawing: DrawingAnnotation = {
        id: "draw_" + Date.now(),
        type: "drawing",
        page: drawingPage,
        points: currentStroke,
        color: isHigh ? "#ffeaa7" : selectedColor,
        strokeWidth: isHigh ? 16 : 3,
        isHighlight: isHigh,
      };
      setAnnotations((prev) => [...prev, newDrawing]);
      setIsDrawing(false);
      setCurrentStroke([]);
    }
  };

  const updateTextAnnotation = (id: string, newText: string) => {
    setAnnotations((prev) =>
      prev.map((a) => (a.id === id && a.type === "text" ? { ...a, text: newText } : a))
    );
  };

  const deleteAnnotation = (id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
  };

  const handleUndo = () => {
    setAnnotations((prev) => prev.slice(0, -1));
  };

  // --- SIGNATURE PAD HANDLERS ---
  const startSigning = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    setIsSigning(true);
  };

  const drawSigning = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSigning) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const endSigning = () => {
    setIsSigning(false);
  };

  const clearSignature = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const applySignature = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");

    const newSig: SignatureAnnotation = {
      id: "sig_" + Date.now(),
      type: "signature",
      page: currentPage,
      x: 0.35,
      y: 0.5,
      width: 0.3,
      height: 0.12,
      dataUrl,
    };

    setAnnotations((prev) => [...prev, newSig]);
    setShowSigModal(false);
    if (onShowToast) onShowToast("Signature placed on current page", "success");
  };

  // --- SAVE AS NEW NON-DESTRUCTIVE PDF ---
  const handleSaveEditedPdf = async () => {
    if (!rawPdfBytes || !filePath) return;
    setIsSaving(true);

    try {
      const pdfLibDoc = await PDFDocument.load(rawPdfBytes);
      const font = await pdfLibDoc.embedFont(
        isBold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica
      );

      const pages = pdfLibDoc.getPages();

      // Process annotations for each page
      for (const annot of annotations) {
        const pageIdx = annot.page - 1;
        if (pageIdx < 0 || pageIdx >= pages.length) continue;
        const page = pages[pageIdx];
        const { width: pWidth, height: pHeight } = page.getSize();

        if (annot.type === "whiteout") {
          const pdfX = annot.x * pWidth;
          const pdfW = annot.width * pWidth;
          const pdfH = annot.height * pHeight;
          const pdfY = pHeight - (annot.y * pHeight) - pdfH;
          const color = annot.color.startsWith("#") ? hexToRgb(annot.color) : rgb(1, 1, 1);

          page.drawRectangle({
            x: pdfX,
            y: pdfY,
            width: pdfW,
            height: pdfH,
            color,
          });
        } else if (annot.type === "text") {
          const pdfX = annot.x * pWidth;
          const pdfY = pHeight - (annot.y * pHeight) - (annot.fontSize * 0.9);
          const color = annot.color.startsWith("#") ? hexToRgb(annot.color) : rgb(0, 0, 0);

          page.drawText(annot.text, {
            x: pdfX,
            y: pdfY,
            size: annot.fontSize,
            font,
            color,
          });
        } else if (annot.type === "signature" && annot.dataUrl) {
          const pngImage = await pdfLibDoc.embedPng(annot.dataUrl);
          const pdfX = annot.x * pWidth;
          const pdfW = annot.width * pWidth;
          const pdfH = annot.height * pHeight;
          const pdfY = pHeight - (annot.y * pHeight) - pdfH;

          page.drawImage(pngImage, {
            x: pdfX,
            y: pdfY,
            width: pdfW,
            height: pdfH,
          });
        }
      }

      const modifiedBytes = await pdfLibDoc.save();

      // Determine dedicated output path
      const targetDir = outputDir || "";
      const newPath = generateDedicatedOutputPath(targetDir, filePath, "annotated");

      if (isTauriEnvironment()) {
        await invoke("write_file_binary", {
          path: newPath,
          data: Array.from(modifiedBytes),
        });
      } else {
        // In browser, trigger download
        const blob = new Blob([modifiedBytes as any], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = newPath.split(/[/\\]/).pop() || "Document_annotated.pdf";
        a.click();
      }

      // Add to work history
      const targetFilename = newPath.split(/[/\\]/).pop() || "Document_annotated.pdf";
      addHistoryRecord({
        filename: targetFilename,
        outputPath: newPath,
        action: "edit",
        actionLabel: "Annotated",
        sourceFiles: [filePath],
        fileSize: modifiedBytes.byteLength,
        pageCount: pages.length,
      });

      if (onShowToast) {
        onShowToast("Newly annotated PDF saved to dedicated storage!", "success");
      }

      if (onFileSaved) {
        onFileSaved(newPath);
      }

      setIsEditMode(false);
      setAnnotations([]);
    } catch (err: any) {
      console.error("Save PDF error:", err);
      if (onShowToast) {
        onShowToast(`Failed to save: ${err?.message || "Unknown error"}`, "warning");
      }
    } finally {
      setIsSaving(false);
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

        {/* Right: Mode Toggles & Save */}
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
            </div>
          )}

          {filePath && (
            <button
              className={`btn-viewer-action ${isEditMode ? "primary" : ""}`}
              onClick={() => setIsEditMode(!isEditMode)}
              title="Toggle PDF Annotations & Markup Tools"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              <span>{isEditMode ? "Close Editor" : "Edit & Markup"}</span>
            </button>
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

      {/* Secondary Edit & Annotation Bar (Visible in Edit Mode) */}
      {isEditMode && (
        <div className="viewer-edit-bar">
          <div className="edit-tools-group">
            <button
              className={`btn-edit-tool ${activeTool === "select" ? "active" : ""}`}
              onClick={() => setActiveTool("select")}
              title="Pan / Select"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
                <path d="M13 13l6 6" />
              </svg>
              <span>Select</span>
            </button>

            <button
              className={`btn-edit-tool ${activeTool === "text" ? "active" : ""}`}
              onClick={() => setActiveTool("text")}
              title="Add Text (Click anywhere on page)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="4 7 4 4 20 4 20 7" />
                <line x1="9" y1="20" x2="15" y2="20" />
                <line x1="12" y1="4" x2="12" y2="20" />
              </svg>
              <span>Text</span>
            </button>

            <button
              className={`btn-edit-tool ${activeTool === "whiteout" ? "active" : ""}`}
              onClick={() => setActiveTool("whiteout")}
              title="Whiteout / Cover text (Draw rectangle to conceal old text)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <span>Whiteout</span>
            </button>

            <button
              className={`btn-edit-tool ${activeTool === "draw" ? "active" : ""}`}
              onClick={() => setActiveTool("draw")}
              title="Freehand Pen / Markup"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
              </svg>
              <span>Pen</span>
            </button>

            <button
              className={`btn-edit-tool ${activeTool === "highlight" ? "active" : ""}`}
              onClick={() => setActiveTool("highlight")}
              title="Highlighter Marker"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m9 11-6 6v3h3l6-6" />
                <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
              </svg>
              <span>Highlight</span>
            </button>

            <button
              className="btn-edit-tool"
              onClick={() => setShowSigModal(true)}
              title="Create & Place Digital Signature"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 19.5c-2.5 0-4-1.5-6-1.5s-4 1.5-6 1.5-4-1.5-6-1.5" />
                <path d="M14 4c0 3-3 6-3 9" />
              </svg>
              <span>Signature</span>
            </button>
          </div>

          <div className="toolbar-sep" />

          {/* Style Controls (Color & Size) */}
          <div className="edit-styles-group">
            <div className="color-palette">
              {["#ff4757", "#2ed573", "#1e90ff", "#ffa502", "#111827", "#ffffff"].map((c) => (
                <button
                  key={c}
                  className={`color-swatch ${selectedColor === c ? "active" : ""}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setSelectedColor(c)}
                  title={`Color ${c}`}
                />
              ))}
            </div>

            {activeTool === "text" && (
              <>
                <select
                  className="font-size-select"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                >
                  <option value={12}>12 pt</option>
                  <option value={14}>14 pt</option>
                  <option value={16}>16 pt</option>
                  <option value={20}>20 pt</option>
                  <option value={24}>24 pt</option>
                  <option value={32}>32 pt</option>
                </select>

                <button
                  className={`btn-font-toggle ${isBold ? "active" : ""}`}
                  onClick={() => setIsBold(!isBold)}
                  title="Toggle Bold"
                >
                  B
                </button>
              </>
            )}
          </div>

          <div className="toolbar-sep" />

          {/* Action & Save Controls */}
          <div className="edit-actions-group">
            {annotations.length > 0 && (
              <button className="btn-edit-tool" onClick={handleUndo} title="Undo Last Annotation">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 7v6h6" />
                  <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                </svg>
                <span>Undo</span>
              </button>
            )}

            <button
              className="btn-save-edited"
              disabled={isSaving || annotations.length === 0}
              onClick={handleSaveEditedPdf}
              title="Bake annotations into a new non-destructive PDF"
            >
              {isSaving ? (
                <>
                  <span className="spinner-mini" />
                  <span>Saving PDF...</span>
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                  <span>Save as New PDF</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

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
              <h3>Select a PDF to View & Edit</h3>
              <p>Choose an output from Work History or select any PDF file from your device to preview and annotate inside PaperFlow.</p>
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
                  <div className="canvas-and-overlay-container">
                    <canvas
                      ref={(el) => {
                        canvasRefs.current[currentPage] = el;
                      }}
                      className="pdf-page-canvas"
                    />

                    {/* Interactive Annotation Layer */}
                    <div
                      className={`page-annotation-overlay ${isEditMode ? `tool-${activeTool}` : ""}`}
                      onMouseDown={(e) => handleOverlayMouseDown(e, currentPage)}
                      onMouseMove={(e) => handleOverlayMouseMove(e, currentPage)}
                      onMouseUp={handleOverlayMouseUp}
                    >
                      {/* Render Page Annotations */}
                      {annotations
                        .filter((a) => a.page === currentPage)
                        .map((annot) => {
                          if (annot.type === "whiteout") {
                            return (
                              <div
                                key={annot.id}
                                className="annot-whiteout-box"
                                style={{
                                  left: `${annot.x * 100}%`,
                                  top: `${annot.y * 100}%`,
                                  width: `${annot.width * 100}%`,
                                  height: `${annot.height * 100}%`,
                                  backgroundColor: annot.color,
                                }}
                              >
                                {isEditMode && (
                                  <button
                                    className="annot-delete-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteAnnotation(annot.id);
                                    }}
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            );
                          } else if (annot.type === "text") {
                            return (
                              <div
                                key={annot.id}
                                className="annot-text-box"
                                style={{
                                  left: `${annot.x * 100}%`,
                                  top: `${annot.y * 100}%`,
                                  fontSize: `${annot.fontSize * scale}px`,
                                  color: annot.color,
                                  fontWeight: annot.isBold ? 700 : 400,
                                }}
                              >
                                {isEditMode ? (
                                  <input
                                    type="text"
                                    value={annot.text}
                                    onChange={(e) => updateTextAnnotation(annot.id, e.target.value)}
                                    className="annot-text-input"
                                    autoFocus
                                  />
                                ) : (
                                  <span>{annot.text}</span>
                                )}
                                {isEditMode && (
                                  <button
                                    className="annot-delete-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteAnnotation(annot.id);
                                    }}
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            );
                          } else if (annot.type === "signature") {
                            return (
                              <div
                                key={annot.id}
                                className="annot-sig-box"
                                style={{
                                  left: `${annot.x * 100}%`,
                                  top: `${annot.y * 100}%`,
                                  width: `${annot.width * 100}%`,
                                  height: `${annot.height * 100}%`,
                                }}
                              >
                                <img src={annot.dataUrl} alt="Signature" />
                                {isEditMode && (
                                  <button
                                    className="annot-delete-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteAnnotation(annot.id);
                                    }}
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            );
                          } else if (annot.type === "drawing" && annot.points.length > 1) {
                            const dims = pageDimensions[currentPage] || { width: 600, height: 800 };
                            const pathData = annot.points
                              .map(
                                (pt, i) => `${i === 0 ? "M" : "L"} ${pt.x * dims.width} ${pt.y * dims.height}`
                              )
                              .join(" ");

                            return (
                              <svg key={annot.id} className="annot-drawing-svg" style={{ width: "100%", height: "100%" }}>
                                <path
                                  d={pathData}
                                  stroke={annot.color}
                                  strokeWidth={annot.strokeWidth * scale}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  fill="none"
                                  opacity={annot.isHighlight ? 0.45 : 1.0}
                                />
                              </svg>
                            );
                          }
                          return null;
                        })}

                      {/* Live Whiteout Drag Preview */}
                      {whiteoutStart && whiteoutCurrent && drawingPage === currentPage && (
                        <div
                          className="whiteout-drag-preview"
                          style={{
                            left: `${Math.min(whiteoutStart.x, whiteoutCurrent.x) * 100}%`,
                            top: `${Math.min(whiteoutStart.y, whiteoutCurrent.y) * 100}%`,
                            width: `${Math.abs(whiteoutCurrent.x - whiteoutStart.x) * 100}%`,
                            height: `${Math.abs(whiteoutCurrent.y - whiteoutStart.y) * 100}%`,
                          }}
                        />
                      )}
                    </div>
                  </div>
                  <div className="page-watermark-label">Page {currentPage} of {numPages}</div>
                </div>
              ) : (
                Array.from({ length: numPages }, (_, i) => i + 1).map((p) => (
                  <div key={p} className="viewer-page-wrapper" id={`viewer-page-${p}`}>
                    <div className="canvas-and-overlay-container">
                      <canvas
                        ref={(el) => {
                          canvasRefs.current[p] = el;
                        }}
                        className="pdf-page-canvas"
                      />

                      {/* Interactive Annotation Layer */}
                      <div
                        className={`page-annotation-overlay ${isEditMode ? `tool-${activeTool}` : ""}`}
                        onMouseDown={(e) => handleOverlayMouseDown(e, p)}
                        onMouseMove={(e) => handleOverlayMouseMove(e, p)}
                        onMouseUp={handleOverlayMouseUp}
                      >
                        {annotations
                          .filter((a) => a.page === p)
                          .map((annot) => {
                            if (annot.type === "whiteout") {
                              return (
                                <div
                                  key={annot.id}
                                  className="annot-whiteout-box"
                                  style={{
                                    left: `${annot.x * 100}%`,
                                    top: `${annot.y * 100}%`,
                                    width: `${annot.width * 100}%`,
                                    height: `${annot.height * 100}%`,
                                    backgroundColor: annot.color,
                                  }}
                                >
                                  {isEditMode && (
                                    <button
                                      className="annot-delete-btn"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteAnnotation(annot.id);
                                      }}
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                              );
                            } else if (annot.type === "text") {
                              return (
                                <div
                                  key={annot.id}
                                  className="annot-text-box"
                                  style={{
                                    left: `${annot.x * 100}%`,
                                    top: `${annot.y * 100}%`,
                                    fontSize: `${annot.fontSize * scale}px`,
                                    color: annot.color,
                                    fontWeight: annot.isBold ? 700 : 400,
                                  }}
                                >
                                  {isEditMode ? (
                                    <input
                                      type="text"
                                      value={annot.text}
                                      onChange={(e) => updateTextAnnotation(annot.id, e.target.value)}
                                      className="annot-text-input"
                                    />
                                  ) : (
                                    <span>{annot.text}</span>
                                  )}
                                  {isEditMode && (
                                    <button
                                      className="annot-delete-btn"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteAnnotation(annot.id);
                                      }}
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                              );
                            } else if (annot.type === "signature") {
                              return (
                                <div
                                  key={annot.id}
                                  className="annot-sig-box"
                                  style={{
                                    left: `${annot.x * 100}%`,
                                    top: `${annot.y * 100}%`,
                                    width: `${annot.width * 100}%`,
                                    height: `${annot.height * 100}%`,
                                  }}
                                >
                                  <img src={annot.dataUrl} alt="Signature" />
                                  {isEditMode && (
                                    <button
                                      className="annot-delete-btn"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteAnnotation(annot.id);
                                      }}
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                              );
                            } else if (annot.type === "drawing" && annot.points.length > 1) {
                              const dims = pageDimensions[p] || { width: 600, height: 800 };
                              const pathData = annot.points
                                .map(
                                  (pt, i) => `${i === 0 ? "M" : "L"} ${pt.x * dims.width} ${pt.y * dims.height}`
                                )
                                .join(" ");

                              return (
                                <svg key={annot.id} className="annot-drawing-svg" style={{ width: "100%", height: "100%" }}>
                                  <path
                                    d={pathData}
                                    stroke={annot.color}
                                    strokeWidth={annot.strokeWidth * scale}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    fill="none"
                                    opacity={annot.isHighlight ? 0.45 : 1.0}
                                  />
                                </svg>
                              );
                            }
                            return null;
                          })}

                        {/* Live Whiteout Drag Preview */}
                        {whiteoutStart && whiteoutCurrent && drawingPage === p && (
                          <div
                            className="whiteout-drag-preview"
                            style={{
                              left: `${Math.min(whiteoutStart.x, whiteoutCurrent.x) * 100}%`,
                              top: `${Math.min(whiteoutStart.y, whiteoutCurrent.y) * 100}%`,
                              width: `${Math.abs(whiteoutCurrent.x - whiteoutStart.x) * 100}%`,
                              height: `${Math.abs(whiteoutCurrent.y - whiteoutStart.y) * 100}%`,
                            }}
                          />
                        )}
                      </div>
                    </div>
                    <div className="page-watermark-label">Page {p} of {numPages}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Signature Creation Modal */}
      {showSigModal && (
        <div className="sig-modal-backdrop" onClick={() => setShowSigModal(false)}>
          <div className="sig-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="sig-modal-header">
              <h4>Draw Your Digital Signature</h4>
              <button className="sig-close-btn" onClick={() => setShowSigModal(false)}>
                ✕
              </button>
            </div>
            <p className="sig-modal-desc">
              Draw your signature below with your mouse, trackpad, or pen. It will be placed directly onto the PDF.
            </p>
            <div className="sig-canvas-wrap">
              <canvas
                ref={sigCanvasRef}
                width={440}
                height={160}
                className="signature-pad-canvas"
                onMouseDown={startSigning}
                onMouseMove={drawSigning}
                onMouseUp={endSigning}
                onMouseLeave={endSigning}
              />
            </div>
            <div className="sig-modal-footer">
              <button className="btn-sig-clear" onClick={clearSignature}>
                Clear
              </button>
              <button className="btn-sig-apply" onClick={applySignature}>
                Place on Page {currentPage}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
