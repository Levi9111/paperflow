import React, { useState, useEffect, useRef, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { PDFDocument, degrees } from "pdf-lib";
import { invoke } from "@tauri-apps/api/core";
import { DocDetails } from "../types/pdf";
import { isTauriEnvironment } from "../utils/platform";
import { generateDedicatedOutputPath } from "../utils/format";
import { addHistoryRecord } from "../utils/historyStore";
import { DocumentCard } from "./DocumentCard";
import { DropZone } from "./DropZone";
import { ActionFeedbackData } from "./ActionFeedbackBanner";

interface SignStampTabProps {
  initialDoc: DocDetails | null;
  outputDir: string;
  onClearDoc: () => void;
  onSelectDoc: (path: string) => void;
  onSetFeedback: (data: ActionFeedbackData) => void;
  onShowToast: (msg: string, type: "info" | "success" | "warning") => void;
  onViewPdf: (path: string) => void;
}

type StampType = "draw" | "official" | "upload";

interface OfficialStampPreset {
  id: string;
  name: string;
  title: string;
  color: string;
  borderColor: string;
  icon: string;
}

const OFFICIAL_STAMPS: OfficialStampPreset[] = [
  {
    id: "approved",
    name: "Approved",
    title: "APPROVED",
    color: "#059669",
    borderColor: "#059669",
    icon: "✓",
  },
  {
    id: "confidential",
    name: "Confidential",
    title: "CONFIDENTIAL",
    color: "#dc2626",
    borderColor: "#dc2626",
    icon: "🔒",
  },
  {
    id: "paid",
    name: "Paid",
    title: "PAID IN FULL",
    color: "#1d4ed8",
    borderColor: "#1d4ed8",
    icon: "★",
  },
  {
    id: "verified",
    name: "Verified",
    title: "OFFICIALLY VERIFIED",
    color: "#d97706",
    borderColor: "#d97706",
    icon: "✦",
  },
  {
    id: "rejected",
    name: "Rejected",
    title: "REJECTED",
    color: "#b91c1c",
    borderColor: "#b91c1c",
    icon: "✕",
  },
];

export const SignStampTab: React.FC<SignStampTabProps> = ({
  initialDoc,
  outputDir,
  onClearDoc,
  onSelectDoc,
  onSetFeedback,
  onShowToast,
  onViewPdf,
}) => {
  const [stampMode, setStampMode] = useState<StampType>("official");

  // Mode A: Draw Signature
  const sigPadRef = useRef<HTMLCanvasElement>(null);
  const [isDrawingSig, setIsDrawingSig] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [penColor, setPenColor] = useState<string>("#0f172a");
  const [penWidth, setPenWidth] = useState<number>(3);
  const [drawnSigDataUrl, setDrawnSigDataUrl] = useState<string | null>(null);

  // Mode B: Official Stamps
  const [selectedPreset, setSelectedPreset] = useState<string>("approved");
  const [includeDate, setIncludeDate] = useState<boolean>(true);
  const [customDate, setCustomDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [departmentText, setDepartmentText] = useState<string>("Authorized Signatory");

  // Mode C: Upload Image Stamp
  const [uploadedStampUrl, setUploadedStampUrl] = useState<string | null>(null);

  // Placement & Transform on PDF Preview
  const [targetPage, setTargetPage] = useState<number>(1);
  const [stampPos, setStampPos] = useState<{ x: number; y: number }>({ x: 0.65, y: 0.8 }); // 0-1 percentage
  const [stampWidthPercent, setStampWidthPercent] = useState<number>(0.28); // 0.15 - 0.5 of page width
  const [stampRotation, setStampRotation] = useState<number>(-6); // realistic rubber stamp angle
  const [stampOpacity, setStampOpacity] = useState<number>(0.92);

  // Preview & Processing state
  const [pdfProxy, setPdfProxy] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [rawPdfBytes, setRawPdfBytes] = useState<Uint8Array | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [pageViewportSize, setPageViewportSize] = useState<{ width: number; height: number }>({ width: 400, height: 600 });
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // Dragging stamp on PDF preview
  const [isDraggingStamp, setIsDraggingStamp] = useState(false);
  const dragStartOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Load PDF for preview when document changes
  useEffect(() => {
    let cancelled = false;

    async function loadDocument() {
      if (!initialDoc) {
        setPdfProxy(null);
        setRawPdfBytes(null);
        return;
      }

      try {
        let bytes: Uint8Array;
        if (isTauriEnvironment()) {
          const raw: number[] = await invoke("read_file_binary", { path: initialDoc.path });
          bytes = new Uint8Array(raw);
        } else {
          const res = await fetch(initialDoc.path);
          const buf = await res.arrayBuffer();
          bytes = new Uint8Array(buf);
        }

        if (cancelled) return;
        setRawPdfBytes(bytes);

        const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
        if (cancelled) return;
        setPdfProxy(doc);
        // Default to last page for signing official documents/contracts
        setTargetPage(doc.numPages);
      } catch (err: any) {
        console.error("Failed to load PDF for signing:", err);
      }
    }

    loadDocument();
    return () => {
      cancelled = true;
    };
  }, [initialDoc]);

  // Render PDF page on base canvas
  const renderPdfPage = useCallback(async () => {
    if (!pdfProxy || !previewCanvasRef.current) return;
    try {
      const page = await pdfProxy.getPage(targetPage);
      const canvas = previewCanvasRef.current;
      const baseViewport = page.getViewport({ scale: 1.0 });
      const maxW = 460;
      const scale = Math.min(1.2, maxW / baseViewport.width);
      const viewport = page.getViewport({ scale });

      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      setPageViewportSize({ width: viewport.width, height: viewport.height });

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const renderCtx = {
        canvas: canvas,
        canvasContext: ctx,
        viewport: viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      };

      await page.render(renderCtx).promise;
    } catch (e) {
      console.warn("Render error:", e);
    }
  }, [pdfProxy, targetPage]);

  useEffect(() => {
    renderPdfPage();
  }, [renderPdfPage]);

  // Signature Pad Handlers (Touch & Mouse Support)
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = sigPadRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startSigDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if ("touches" in e) e.preventDefault();
    const canvas = sigPadRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const coords = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    setIsDrawingSig(true);
    setHasSignature(true);
  };

  const drawSigMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingSig) return;
    if ("touches" in e) e.preventDefault();
    const canvas = sigPadRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const coords = getCanvasCoords(e);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const endSigDraw = () => {
    if (!isDrawingSig) return;
    setIsDrawingSig(false);
    const canvas = sigPadRef.current;
    if (canvas) {
      setDrawnSigDataUrl(canvas.toDataURL("image/png"));
    }
  };

  const clearSignature = () => {
    const canvas = sigPadRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    setDrawnSigDataUrl(null);
  };

  // Generate Official Stamp Data URL
  const generateOfficialStampDataUrl = useCallback((): string => {
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 200;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    const stamp = OFFICIAL_STAMPS.find((s) => s.id === selectedPreset) || OFFICIAL_STAMPS[0];

    // Background slight warm tint
    ctx.fillStyle = "rgba(255, 255, 255, 0.0)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Double-lined official rubber stamp border
    ctx.strokeStyle = stamp.borderColor;
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

    ctx.lineWidth = 2.5;
    ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);

    // Stamp Header Title
    ctx.fillStyle = stamp.color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 38px 'Arial Black', sans-serif";
    ctx.fillText(stamp.title, canvas.width / 2, 70);

    // Divider line
    ctx.beginPath();
    ctx.moveTo(35, 115);
    ctx.lineTo(canvas.width - 35, 115);
    ctx.lineWidth = 2;
    ctx.stroke();

    // Department / Signatory subtitle
    ctx.font = "bold 20px 'Segoe UI', sans-serif";
    ctx.fillText(departmentText.toUpperCase(), canvas.width / 2, 142);

    // Date stamp
    if (includeDate) {
      ctx.font = "16px monospace";
      ctx.fillText(`DATE: ${customDate}`, canvas.width / 2, 172);
    }

    return canvas.toDataURL("image/png");
  }, [selectedPreset, includeDate, customDate, departmentText]);

  // Handle uploaded stamp image
  const handleStampUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const res = ev.target?.result;
      if (typeof res === "string") {
        setUploadedStampUrl(res);
      }
    };
    reader.readAsDataURL(file);
  };

  // Get current active stamp image URL for preview and burn
  const getActiveStampUrl = useCallback((): string | null => {
    if (stampMode === "draw") {
      return drawnSigDataUrl;
    }
    if (stampMode === "official") {
      return generateOfficialStampDataUrl();
    }
    if (stampMode === "upload") {
      return uploadedStampUrl;
    }
    return null;
  }, [stampMode, drawnSigDataUrl, generateOfficialStampDataUrl, uploadedStampUrl]);

  // Preview overlay interaction: click or drag to move stamp
  const handlePreviewClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingStamp) return;
    const container = previewContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = Math.max(0.1, Math.min(0.9, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0.1, Math.min(0.9, (e.clientY - rect.top) / rect.height));
    setStampPos({ x, y });
  };

  const handleStampMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsDraggingStamp(true);
    const container = previewContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const currentPxX = stampPos.x * rect.width;
    const currentPxY = stampPos.y * rect.height;
    dragStartOffset.current = {
      x: e.clientX - currentPxX,
      y: e.clientY - currentPxY,
    };
  };

  const handleContainerMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingStamp) return;
    const container = previewContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const newX = (e.clientX - dragStartOffset.current.x) / rect.width;
    const newY = (e.clientY - dragStartOffset.current.y) / rect.height;
    setStampPos({
      x: Math.max(0.05, Math.min(0.95, newX)),
      y: Math.max(0.05, Math.min(0.95, newY)),
    });
  };

  const handleContainerMouseUp = () => {
    setIsDraggingStamp(false);
  };

  // Execute Burn Signature / Stamp onto PDF
  const handleBurnAndSave = async () => {
    if (!initialDoc || !rawPdfBytes) return;
    const activeUrl = getActiveStampUrl();
    if (!activeUrl) {
      onShowToast("Please draw a signature or select a stamp first", "warning");
      return;
    }

    setIsProcessing(true);

    try {
      const pdfLibDoc = await PDFDocument.load(rawPdfBytes);
      const totalPages = pdfLibDoc.getPageCount();
      const pageIndex = targetPage - 1;

      if (pageIndex < 0 || pageIndex >= totalPages) {
        throw new Error("Invalid target page");
      }

      const page = pdfLibDoc.getPage(pageIndex);
      const { width: pWidth, height: pHeight } = page.getSize();

      const embeddedImg = await pdfLibDoc.embedPng(activeUrl).catch(async () => {
        return await pdfLibDoc.embedJpg(activeUrl);
      });

      const stampW = pWidth * stampWidthPercent;
      const aspect = embeddedImg.width / embeddedImg.height;
      const stampH = stampW / aspect;

      // Calculate PDF origin (PDF (0,0) is bottom-left)
      const pdfX = stampPos.x * pWidth - stampW / 2;
      const pdfY = pHeight - stampPos.y * pHeight - stampH / 2;

      page.drawImage(embeddedImg, {
        x: pdfX,
        y: pdfY,
        width: stampW,
        height: stampH,
        opacity: stampOpacity,
        rotate: degrees(stampRotation),
      });

      const savedBytes = await pdfLibDoc.save();
      const actionTag = stampMode === "draw" ? "signed" : "stamped";
      const outPath = generateDedicatedOutputPath(initialDoc.path, actionTag, outputDir);

      if (isTauriEnvironment()) {
        await invoke("write_file_binary", {
          path: outPath,
          data: Array.from(savedBytes),
        });
      } else {
        const blob = new Blob([savedBytes.buffer as ArrayBuffer], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = outPath.split(/[/\\]/).pop() || "signed_document.pdf";
        a.click();
      }

      // Record in history
      const savedFilename = outPath.split(/[/\\]/).pop() || "Document.pdf";
      addHistoryRecord({
        outputPath: outPath,
        filename: savedFilename,
        action: "sign",
        actionLabel: stampMode === "draw" ? "Signed" : "Stamped",
        sourceFiles: [initialDoc.path],
        fileSize: savedBytes.byteLength,
        pageCount: totalPages,
      });

      onSetFeedback({
        type: "success",
        title: stampMode === "draw" ? "Document Signed" : "Stamp Applied",
        message: `Successfully burned ${stampMode === "draw" ? "signature" : "stamp"} onto page ${targetPage} and saved new file.`,
        outputPath: outPath,
        fileSize: savedBytes.byteLength,
        pageCount: totalPages,
      });

      onShowToast(
        stampMode === "draw" ? "Signature burned into PDF!" : "Official stamp burned into PDF!",
        "success"
      );
    } catch (err: any) {
      console.error("Failed to sign/stamp document:", err);
      onShowToast(`Failed: ${err?.message || "Operation failed"}`, "warning");
    } finally {
      setIsProcessing(false);
    }
  };

  const activeStampPreviewUrl = getActiveStampUrl();

  return (
    <div className="watermark-tab-container sign-stamp-container">
      {/* Submode Switcher */}
      <div className="submode-pill-bar">
        <button
          type="button"
          className={`submode-pill ${stampMode === "official" ? "active" : ""}`}
          onClick={() => {
            setStampMode("official");
            setStampRotation(-8);
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="m9 12 2 2 4-4" />
          </svg>
          Official Rubber Stamps
        </button>
        <button
          type="button"
          className={`submode-pill ${stampMode === "draw" ? "active" : ""}`}
          onClick={() => {
            setStampMode("draw");
            setStampRotation(0);
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m18 2 4 4-14 14H4v-4L18 2z" />
          </svg>
          Draw Signature
        </button>
        <button
          type="button"
          className={`submode-pill ${stampMode === "upload" ? "active" : ""}`}
          onClick={() => {
            setStampMode("upload");
            setStampRotation(0);
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Upload Stamp / Seal
        </button>
      </div>

      {!initialDoc ? (
        <DropZone
          onFilesSelected={(paths) => paths[0] && onSelectDoc(paths[0])}
          title="Drop PDF to Sign or Apply Official Stamp"
          subtitle="Place executive handwritten signatures, approval badges, or banking stamps anywhere on the page"
        />
      ) : (
        <div className="watermark-layout-grid">
          {/* Left Column: Stamp Selector / Creator */}
          <div className="watermark-controls-card">
            <DocumentCard
              doc={initialDoc}
              onRemove={onClearDoc}
            />

            <div className="control-groups-wrap">
              {stampMode === "official" && (
                <>
                  <div className="control-block">
                    <span className="control-label">Official Rubber Stamp Presets</span>
                    <div className="official-stamps-grid">
                      {OFFICIAL_STAMPS.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className={`stamp-preset-card ${selectedPreset === s.id ? "active" : ""}`}
                          style={{ borderColor: selectedPreset === s.id ? s.color : "rgba(255,255,255,0.12)" }}
                          onClick={() => setSelectedPreset(s.id)}
                        >
                          <span className="stamp-icon" style={{ color: s.color }}>
                            {s.icon}
                          </span>
                          <span className="stamp-name" style={{ color: s.color }}>
                            {s.title}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="control-block">
                    <label className="control-label" htmlFor="dept-input">Signatory / Department Subtitle</label>
                    <input
                      id="dept-input"
                      type="text"
                      className="text-input-field"
                      value={departmentText}
                      onChange={(e) => setDepartmentText(e.target.value)}
                      placeholder="e.g. Finance Department, Legal Counsel"
                    />
                  </div>

                  <div className="option-row">
                    <label className="checkbox-toggle-label">
                      <input
                        type="checkbox"
                        checked={includeDate}
                        onChange={(e) => setIncludeDate(e.target.checked)}
                      />
                      <span>Include Date Stamp</span>
                    </label>
                    {includeDate && (
                      <input
                        type="date"
                        className="text-input-field"
                        value={customDate}
                        onChange={(e) => setCustomDate(e.target.value)}
                        style={{ width: "150px" }}
                      />
                    )}
                  </div>
                </>
              )}

              {stampMode === "draw" && (
                <div className="control-block">
                  <div className="sig-header-row">
                    <span className="control-label">Sign Here (Touch or Mouse)</span>
                    <div className="pen-tools-wrap">
                      {[2, 3.5, 5].map((w) => (
                        <button
                          key={w}
                          type="button"
                          className={`chip-btn ${penWidth === w ? "active" : ""}`}
                          onClick={() => setPenWidth(w)}
                          title={`${w}px width`}
                          style={{ padding: "2px 6px", fontSize: "10.5px" }}
                        >
                          {w === 2 ? "Fine" : w === 3.5 ? "Med" : "Bold"}
                        </button>
                      ))}
                      {[
                        { color: "#0f172a", label: "Black" },
                        { color: "#1e3a8a", label: "Executive Blue" },
                        { color: "#991b1b", label: "Formal Red" },
                      ].map((p) => (
                        <button
                          key={p.color}
                          type="button"
                          className={`pen-color-dot ${penColor === p.color ? "active" : ""}`}
                          style={{ backgroundColor: p.color }}
                          onClick={() => setPenColor(p.color)}
                          title={p.label}
                        />
                      ))}
                      <button
                        type="button"
                        className="btn-clear-sig"
                        onClick={clearSignature}
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="sig-pad-wrapper">
                    <canvas
                      ref={sigPadRef}
                      width={400}
                      height={150}
                      className="sig-pad-canvas"
                      onMouseDown={startSigDraw}
                      onMouseMove={drawSigMove}
                      onMouseUp={endSigDraw}
                      onMouseLeave={endSigDraw}
                      onTouchStart={startSigDraw}
                      onTouchMove={drawSigMove}
                      onTouchEnd={endSigDraw}
                    />
                    {!hasSignature && (
                      <div className="sig-pad-watermark-hint">
                        Draw your signature here with finger, stylus or mouse
                      </div>
                    )}
                  </div>
                </div>
              )}

              {stampMode === "upload" && (
                <div className="control-block">
                  <span className="control-label">Upload Signature or Seal Image</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={handleStampUpload}
                    className="file-upload-input"
                  />
                  {uploadedStampUrl && (
                    <div className="image-preview-box">
                      <img src={uploadedStampUrl} alt="Uploaded Stamp" className="uploaded-wm-thumb" />
                    </div>
                  )}
                </div>
              )}

              {/* Placement & Transform Controls */}
              <div className="control-block">
                <span className="control-label">Target Page</span>
                <div className="page-jump-row">
                  <button
                    type="button"
                    className={`page-pill-btn ${targetPage === 1 ? "active" : ""}`}
                    onClick={() => setTargetPage(1)}
                  >
                    First Page (1)
                  </button>
                  <button
                    type="button"
                    className={`page-pill-btn ${targetPage === initialDoc.page_count ? "active" : ""}`}
                    onClick={() => setTargetPage(initialDoc.page_count)}
                  >
                    Last Page ({initialDoc.page_count})
                  </button>
                  <div className="custom-page-stepper">
                    <button
                      type="button"
                      disabled={targetPage <= 1}
                      onClick={() => setTargetPage((p) => Math.max(1, p - 1))}
                    >
                      ‹
                    </button>
                    <span>Page {targetPage}</span>
                    <button
                      type="button"
                      disabled={targetPage >= initialDoc.page_count}
                      onClick={() => setTargetPage((p) => Math.min(initialDoc.page_count, p + 1))}
                    >
                      ›
                    </button>
                  </div>
                </div>
              </div>

              {/* Stamp Size & Angle Sliders */}
              <div className="sliders-dual-grid">
                <div className="slider-group">
                  <div className="slider-label-row">
                    <span>Stamp Size</span>
                    <span className="slider-val">{Math.round(stampWidthPercent * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="50"
                    value={Math.round(stampWidthPercent * 100)}
                    onChange={(e) => setStampWidthPercent(Number(e.target.value) / 100)}
                    className="range-slider"
                  />
                </div>

                <div className="slider-group">
                  <div className="slider-label-row">
                    <span>Angle / Tilt</span>
                    <span className="slider-val">{stampRotation}°</span>
                  </div>
                  <input
                    type="range"
                    min="-25"
                    max="25"
                    value={stampRotation}
                    onChange={(e) => setStampRotation(Number(e.target.value))}
                    className="range-slider"
                  />
                </div>
              </div>

              <div className="slider-group">
                <div className="slider-label-row">
                  <span>Stamp Opacity</span>
                  <span className="slider-val">{Math.round(stampOpacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={Math.round(stampOpacity * 100)}
                  onChange={(e) => setStampOpacity(Number(e.target.value) / 100)}
                  className="range-slider"
                />
              </div>
            </div>

            {/* Execute Burn Button */}
            <button
              type="button"
              className="btn-primary btn-action-large"
              disabled={isProcessing || !activeStampPreviewUrl}
              onClick={handleBurnAndSave}
            >
              {isProcessing ? (
                <>
                  <span className="spinner-sm" /> Burning into PDF...
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {stampMode === "draw" ? "Burn Signature into PDF" : "Burn Stamp into PDF"}
                </>
              )}
            </button>
          </div>

          {/* Right Column: Visual Placement on PDF */}
          <div className="watermark-preview-card">
            <div className="preview-header">
              <span className="preview-title">
                Drag or Click to Position {stampMode === "draw" ? "Signature" : "Stamp"}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <button
                  type="button"
                  className="btn-action-view"
                  style={{
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-secondary)",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontSize: "11px",
                    cursor: "pointer",
                  }}
                  onClick={() => initialDoc && onViewPdf(initialDoc.path)}
                  title="Open in In-App PDF Viewer"
                >
                  Full Viewer ↗
                </button>
                <span className="preview-page-counter">
                  Page {targetPage} of {initialDoc.page_count}
                </span>
              </div>
            </div>

            <div
              ref={previewContainerRef}
              className="interactive-stamp-container"
              onClick={handlePreviewClick}
              onMouseMove={handleContainerMouseMove}
              onMouseUp={handleContainerMouseUp}
              onMouseLeave={handleContainerMouseUp}
              style={{
                width: `${pageViewportSize.width}px`,
                height: `${pageViewportSize.height}px`,
              }}
            >
              <canvas ref={previewCanvasRef} className="pdf-base-canvas" />

              {/* Floating Stamp / Signature Placement Widget */}
              {activeStampPreviewUrl && (
                <div
                  className={`floating-stamp-box ${isDraggingStamp ? "dragging" : ""}`}
                  style={{
                    left: `${stampPos.x * 100}%`,
                    top: `${stampPos.y * 100}%`,
                    width: `${stampWidthPercent * pageViewportSize.width}px`,
                    transform: `translate(-50%, -50%) rotate(${stampRotation}deg)`,
                    opacity: stampOpacity,
                  }}
                  onMouseDown={handleStampMouseDown}
                  title="Click & Drag to Reposition"
                >
                  <img
                    src={activeStampPreviewUrl}
                    alt="Stamp / Signature"
                    className="floating-stamp-img"
                    draggable={false}
                  />
                  <div className="stamp-drag-handle" title="Drag to reposition">
                    ✢
                  </div>
                </div>
              )}
            </div>

            <div className="preview-hint-bar">
              💡 Tap or drag anywhere on the document to place the stamp. Size and tilt adjust above.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
