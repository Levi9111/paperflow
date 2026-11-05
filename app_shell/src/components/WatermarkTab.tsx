import React, { useState, useEffect, useRef, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { PDFDocument, rgb, degrees, StandardFonts } from "pdf-lib";
import { invoke } from "@tauri-apps/api/core";
import { DocDetails } from "../types/pdf";
import { isTauriEnvironment } from "../utils/platform";
import { generateDedicatedOutputPath } from "../utils/format";
import { addHistoryRecord } from "../utils/historyStore";
import { DocumentCard } from "./DocumentCard";
import { DropZone } from "./DropZone";
import { ActionFeedbackData } from "./ActionFeedbackBanner";

interface WatermarkTabProps {
  initialDoc: DocDetails | null;
  outputDir: string;
  onClearDoc: () => void;
  onSelectDoc: (path: string) => void;
  onSetFeedback: (data: ActionFeedbackData) => void;
  onShowToast: (msg: string, type: "info" | "success" | "warning") => void;
  onViewPdf: (path: string) => void;
}

type WatermarkSubMode = "watermark" | "numbers";
type WatermarkType = "text" | "image";
type WatermarkAngle = 0 | 45 | -45 | 90;
type PageNumberPos = "topleft" | "topcenter" | "topright" | "bottomleft" | "bottomcenter" | "bottomright";

const PRESET_WATERMARKS = [
  "CONFIDENTIAL",
  "DRAFT",
  "COPY",
  "FOR INTERNAL USE ONLY",
  "SAMPLE",
  "URGENT",
  "APPROVED",
];

const COLOR_PRESETS = [
  { name: "Ruby Red", hex: "#dc2626", rgb: [0.86, 0.15, 0.15] },
  { name: "Executive Gray", hex: "#4b5563", rgb: [0.29, 0.33, 0.39] },
  { name: "Navy Blue", hex: "#1d4ed8", rgb: [0.11, 0.31, 0.85] },
  { name: "Forest Green", hex: "#059669", rgb: [0.02, 0.59, 0.41] },
  { name: "Deep Charcoal", hex: "#111827", rgb: [0.07, 0.09, 0.15] },
  { name: "Amber Orange", hex: "#d97706", rgb: [0.85, 0.47, 0.02] },
];

export const WatermarkTab: React.FC<WatermarkTabProps> = ({
  initialDoc,
  outputDir,
  onClearDoc,
  onSelectDoc,
  onSetFeedback,
  onShowToast,
  onViewPdf,
}) => {
  const [subMode, setSubMode] = useState<WatermarkSubMode>("watermark");

  // Watermark state
  const [wmType, setWmType] = useState<WatermarkType>("text");
  const [wmText, setWmText] = useState<string>("CONFIDENTIAL");
  const [wmFontSize, setWmFontSize] = useState<number>(44);
  const [wmAngle, setWmAngle] = useState<WatermarkAngle>(45);
  const [wmOpacity, setWmOpacity] = useState<number>(0.28);
  const [wmColor, setWmColor] = useState<string>("#dc2626");
  const [wmTiled, setWmTiled] = useState<boolean>(false);
  const [wmScope, setWmScope] = useState<"all" | "first" | "skipfirst">("all");
  const [wmImageBytes, setWmImageBytes] = useState<Uint8Array | null>(null);
  const [wmImagePreview, setWmImagePreview] = useState<string | null>(null);

  // Page Numbers state
  const [pnFormat, setPnFormat] = useState<string>("Page {page} of {total}");
  const [pnPosition, setPnPosition] = useState<PageNumberPos>("bottomcenter");
  const [pnFontSize, setPnFontSize] = useState<number>(10);
  const [pnMargin, setPnMargin] = useState<number>(30);
  const [pnStartPage, setPnStartPage] = useState<number>(1);
  const [pnColor, setPnColor] = useState<string>("#4b5563");

  // Preview & Processing state
  const [previewPage, setPreviewPage] = useState<number>(1);
  const [pdfProxy, setPdfProxy] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [rawPdfBytes, setRawPdfBytes] = useState<Uint8Array | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

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
        setPreviewPage(1);
      } catch (err: any) {
        console.error("Failed to load PDF for preview:", err);
      }
    }

    loadDocument();
    return () => {
      cancelled = true;
    };
  }, [initialDoc]);

  // Render PDF page on base canvas
  const renderBasePage = useCallback(async () => {
    if (!pdfProxy || !previewCanvasRef.current) return;
    try {
      const page = await pdfProxy.getPage(previewPage);
      const canvas = previewCanvasRef.current;
      const overlay = overlayCanvasRef.current;

      const baseViewport = page.getViewport({ scale: 1.0 });
      const maxW = 480;
      const scale = Math.min(1.2, maxW / baseViewport.width);
      const viewport = page.getViewport({ scale });

      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      if (overlay) {
        overlay.width = Math.floor(viewport.width * dpr);
        overlay.height = Math.floor(viewport.height * dpr);
        overlay.style.width = `${Math.floor(viewport.width)}px`;
        overlay.style.height = `${Math.floor(viewport.height)}px`;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const renderCtx = {
        canvas: canvas,
        canvasContext: ctx,
        viewport: viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      };

      await page.render(renderCtx).promise;
      drawPreviewOverlay(viewport.width, viewport.height, dpr);
    } catch (e) {
      console.warn("Preview render error:", e);
    }
  }, [pdfProxy, previewPage, subMode, wmType, wmText, wmFontSize, wmAngle, wmOpacity, wmColor, wmTiled, wmScope, pnFormat, pnPosition, pnFontSize, pnMargin, pnStartPage, pnColor, wmImagePreview]);

  useEffect(() => {
    renderBasePage();
  }, [renderBasePage]);

  // Draw real-time preview overlay of Watermark or Page Numbers
  const drawPreviewOverlay = (width: number, height: number, dpr: number) => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    if (subMode === "watermark") {
      // Check scope
      const shouldDraw =
        wmScope === "all" ||
        (wmScope === "first" && previewPage === 1) ||
        (wmScope === "skipfirst" && previewPage > 1);

      if (shouldDraw) {
        ctx.globalAlpha = wmOpacity;
        if (wmType === "text" && wmText.trim()) {
          ctx.fillStyle = wmColor;
          ctx.font = `bold ${Math.floor(wmFontSize * 0.75)}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          if (wmTiled) {
            // Tiled 3x3 pattern
            for (let row = 0; row < 3; row++) {
              for (let col = 0; col < 3; col++) {
                const cx = (col + 0.5) * (width / 3);
                const cy = (row + 0.5) * (height / 3);
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate((wmAngle * Math.PI) / 180);
                ctx.fillText(wmText, 0, 0);
                ctx.restore();
              }
            }
          } else {
            // Single Centered
            ctx.save();
            ctx.translate(width / 2, height / 2);
            ctx.rotate((wmAngle * Math.PI) / 180);
            ctx.fillText(wmText, 0, 0);
            ctx.restore();
          }
        } else if (wmType === "image" && wmImagePreview) {
          const img = new Image();
          img.src = wmImagePreview;
          img.onload = () => {
            const aspect = img.width / img.height;
            const targetW = width * 0.45;
            const targetH = targetW / aspect;
            ctx.save();
            ctx.globalAlpha = wmOpacity;
            ctx.translate(width / 2, height / 2);
            ctx.rotate((wmAngle * Math.PI) / 180);
            ctx.drawImage(img, -targetW / 2, -targetH / 2, targetW, targetH);
            ctx.restore();
          };
        }
      }
    } else {
      // Page numbers overlay
      if (previewPage >= pnStartPage) {
        const total = initialDoc?.page_count || 1;
        const text = pnFormat
          .replace("{page}", String(previewPage))
          .replace("{total}", String(total));

        ctx.fillStyle = pnColor;
        ctx.font = `${Math.floor(pnFontSize * 0.85)}px sans-serif`;
        ctx.textBaseline = "middle";

        const m = pnMargin * 0.5;
        let x = width / 2;
        let y = height - m;

        if (pnPosition === "topleft") {
          ctx.textAlign = "left";
          x = m;
          y = m;
        } else if (pnPosition === "topcenter") {
          ctx.textAlign = "center";
          x = width / 2;
          y = m;
        } else if (pnPosition === "topright") {
          ctx.textAlign = "right";
          x = width - m;
          y = m;
        } else if (pnPosition === "bottomleft") {
          ctx.textAlign = "left";
          x = m;
          y = height - m;
        } else if (pnPosition === "bottomcenter") {
          ctx.textAlign = "center";
          x = width / 2;
          y = height - m;
        } else if (pnPosition === "bottomright") {
          ctx.textAlign = "right";
          x = width - m;
          y = height - m;
        }

        ctx.fillText(text, x, y);
      }
    }

    ctx.restore();
  };

  // Handle image upload for watermark
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const res = ev.target?.result;
      if (typeof res === "string") {
        setWmImagePreview(res);
      }
      if (res instanceof ArrayBuffer) {
        setWmImageBytes(new Uint8Array(res));
      }
    };
    reader.readAsDataURL(file);

    const readerBuf = new FileReader();
    readerBuf.onload = (ev) => {
      if (ev.target?.result instanceof ArrayBuffer) {
        setWmImageBytes(new Uint8Array(ev.target.result));
      }
    };
    readerBuf.readAsArrayBuffer(file);
  };

  // Helper: parse hex color to rgb [0-1]
  const parseRgb = (hex: string) => {
    let clean = hex.replace("#", "");
    if (clean.length === 3) clean = clean.split("").map((c) => c + c).join("");
    const num = parseInt(clean, 16);
    return rgb((num >> 16) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255);
  };

  // Execution: Apply Watermark or Page Numbers
  const handleApply = async () => {
    if (!initialDoc || !rawPdfBytes) return;
    setIsProcessing(true);

    try {
      const pdfLibDoc = await PDFDocument.load(rawPdfBytes);
      const totalPages = pdfLibDoc.getPageCount();
      const pages = pdfLibDoc.getPages();

      if (subMode === "watermark") {
        if (wmType === "text") {
          const font = await pdfLibDoc.embedFont(StandardFonts.HelveticaBold);
          const color = parseRgb(wmColor);

          pages.forEach((page, idx) => {
            const pageNum = idx + 1;
            const shouldApply =
              wmScope === "all" ||
              (wmScope === "first" && pageNum === 1) ||
              (wmScope === "skipfirst" && pageNum > 1);

            if (!shouldApply) return;

            const { width, height } = page.getSize();
            const textWidth = font.widthOfTextAtSize(wmText, wmFontSize);
            const textHeight = font.heightAtSize(wmFontSize);

            if (wmTiled) {
              // Draw 3x3 tiled grid
              for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 3; c++) {
                  const cx = (c + 0.5) * (width / 3);
                  const cy = (r + 0.5) * (height / 3);
                  page.drawText(wmText, {
                    x: cx - (textWidth / 2) * Math.cos((wmAngle * Math.PI) / 180),
                    y: cy - (textHeight / 2) * Math.sin((wmAngle * Math.PI) / 180),
                    size: wmFontSize * 0.7,
                    font,
                    color,
                    opacity: wmOpacity,
                    rotate: degrees(wmAngle),
                  });
                }
              }
            } else {
              // Center position calculation accounting for rotation angle
              const rad = (wmAngle * Math.PI) / 180;
              const cx = width / 2;
              const cy = height / 2;
              const offsetX = (textWidth / 2) * Math.cos(rad) - (textHeight / 2) * Math.sin(rad);
              const offsetY = (textWidth / 2) * Math.sin(rad) + (textHeight / 2) * Math.cos(rad);

              page.drawText(wmText, {
                x: cx - offsetX,
                y: cy - offsetY,
                size: wmFontSize,
                font,
                color,
                opacity: wmOpacity,
                rotate: degrees(wmAngle),
              });
            }
          });
        } else if (wmType === "image" && wmImageBytes) {
          const embeddedImage = await pdfLibDoc.embedPng(wmImageBytes).catch(async () => {
            return await pdfLibDoc.embedJpg(wmImageBytes!);
          });

          pages.forEach((page, idx) => {
            const pageNum = idx + 1;
            const shouldApply =
              wmScope === "all" ||
              (wmScope === "first" && pageNum === 1) ||
              (wmScope === "skipfirst" && pageNum > 1);

            if (!shouldApply) return;

            const { width, height } = page.getSize();
            const targetW = width * 0.45;
            const aspect = embeddedImage.width / embeddedImage.height;
            const targetH = targetW / aspect;

            page.drawImage(embeddedImage, {
              x: width / 2 - targetW / 2,
              y: height / 2 - targetH / 2,
              width: targetW,
              height: targetH,
              opacity: wmOpacity,
              rotate: degrees(wmAngle),
            });
          });
        }
      } else {
        // Page Numbers mode
        const font = await pdfLibDoc.embedFont(StandardFonts.Helvetica);
        const color = parseRgb(pnColor);

        pages.forEach((page, idx) => {
          const pageNum = idx + 1;
          if (pageNum < pnStartPage) return;

          const text = pnFormat
            .replace("{page}", String(pageNum))
            .replace("{total}", String(totalPages));

          const { width, height } = page.getSize();
          const textW = font.widthOfTextAtSize(text, pnFontSize);
          const m = pnMargin;

          let x = (width - textW) / 2;
          let y = m;

          if (pnPosition === "topleft") {
            x = m;
            y = height - m - pnFontSize;
          } else if (pnPosition === "topcenter") {
            x = (width - textW) / 2;
            y = height - m - pnFontSize;
          } else if (pnPosition === "topright") {
            x = width - m - textW;
            y = height - m - pnFontSize;
          } else if (pnPosition === "bottomleft") {
            x = m;
            y = m;
          } else if (pnPosition === "bottomcenter") {
            x = (width - textW) / 2;
            y = m;
          } else if (pnPosition === "bottomright") {
            x = width - m - textW;
            y = m;
          }

          page.drawText(text, {
            x,
            y,
            size: pnFontSize,
            font,
            color,
          });
        });
      }

      const savedBytes = await pdfLibDoc.save();
      const actionTag = subMode === "watermark" ? "watermarked" : "numbered";
      const outPath = generateDedicatedOutputPath(initialDoc.path, actionTag, outputDir);

      if (isTauriEnvironment()) {
        await invoke("write_file_binary", {
          path: outPath,
          data: Array.from(savedBytes),
        });
      } else {
        // Browser download fallback
        const blob = new Blob([savedBytes.buffer as ArrayBuffer], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = outPath.split(/[/\\]/).pop() || "output.pdf";
        a.click();
      }

      // Record in history
      const savedFilename = outPath.split(/[/\\]/).pop() || "Document.pdf";
      addHistoryRecord({
        outputPath: outPath,
        filename: savedFilename,
        action: "watermark",
        actionLabel: subMode === "watermark" ? "Watermarked" : "Page Numbered",
        sourceFiles: [initialDoc.path],
        fileSize: savedBytes.byteLength,
        pageCount: totalPages,
      });

      onSetFeedback({
        type: "success",
        title: subMode === "watermark" ? "Watermark Applied" : "Page Numbers Added",
        message: `Successfully processed ${totalPages} pages and saved as a non-destructive new file.`,
        outputPath: outPath,
        fileSize: savedBytes.byteLength,
        pageCount: totalPages,
      });

      onShowToast(
        subMode === "watermark" ? "Watermark applied successfully!" : "Page numbers added successfully!",
        "success"
      );
    } catch (err: any) {
      console.error("Failed to apply watermark/numbers:", err);
      onShowToast(`Failed: ${err?.message || "Operation failed"}`, "warning");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="watermark-tab-container">
      {/* Submode Switcher Tabs */}
      <div className="submode-pill-bar">
        <button
          type="button"
          className={`submode-pill ${subMode === "watermark" ? "active" : ""}`}
          onClick={() => setSubMode("watermark")}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
          </svg>
          Watermark
        </button>
        <button
          type="button"
          className={`submode-pill ${subMode === "numbers" ? "active" : ""}`}
          onClick={() => setSubMode("numbers")}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="9" x2="20" y2="9" />
            <line x1="4" y1="15" x2="20" y2="15" />
            <line x1="10" y1="3" x2="8" y2="21" />
            <line x1="16" y1="3" x2="14" y2="21" />
          </svg>
          Page Numbers (Bates)
        </button>
      </div>

      {!initialDoc ? (
        <DropZone
          onFilesSelected={(paths) => paths[0] && onSelectDoc(paths[0])}
          title="Drop PDF to Add Watermark or Page Numbers"
          subtitle="Stamp confidentiality marks, draft badges, or Bates numbering non-destructively"
        />
      ) : (
        <div className="watermark-layout-grid">
          {/* Left Column: Controls */}
          <div className="watermark-controls-card">
            <DocumentCard
              doc={initialDoc}
              onRemove={onClearDoc}
            />

            {subMode === "watermark" ? (
              <div className="control-groups-wrap">
                {/* Text vs Image toggle */}
                <div className="option-row">
                  <span className="control-label">Type</span>
                  <div className="segmented-control">
                    <button
                      type="button"
                      className={`seg-btn ${wmType === "text" ? "active" : ""}`}
                      onClick={() => setWmType("text")}
                    >
                      Text
                    </button>
                    <button
                      type="button"
                      className={`seg-btn ${wmType === "image" ? "active" : ""}`}
                      onClick={() => setWmType("image")}
                    >
                      Logo / Image
                    </button>
                  </div>
                </div>

                {wmType === "text" ? (
                  <>
                    {/* Watermark Preset Chips */}
                    <div className="control-block">
                      <span className="control-label">Quick Presets</span>
                      <div className="preset-chips-wrap">
                        {PRESET_WATERMARKS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            className={`chip-btn ${wmText === preset ? "active" : ""}`}
                            onClick={() => setWmText(preset)}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Watermark Text Input */}
                    <div className="control-block">
                      <label className="control-label" htmlFor="wm-custom-text">Watermark Text</label>
                      <input
                        id="wm-custom-text"
                        type="text"
                        className="text-input-field"
                        value={wmText}
                        onChange={(e) => setWmText(e.target.value)}
                        placeholder="e.g. CONFIDENTIAL, DRAFT, INTERNAL USE"
                      />
                    </div>

                    {/* Color Presets */}
                    <div className="control-block">
                      <span className="control-label">Stamp Color</span>
                      <div className="color-swatches-wrap">
                        {COLOR_PRESETS.map((c) => (
                          <button
                            key={c.hex}
                            type="button"
                            className={`color-swatch ${wmColor === c.hex ? "selected" : ""}`}
                            style={{ backgroundColor: c.hex }}
                            onClick={() => setWmColor(c.hex)}
                            title={c.name}
                          />
                        ))}
                        <input
                          type="color"
                          className="custom-color-picker"
                          value={wmColor}
                          onChange={(e) => setWmColor(e.target.value)}
                          title="Custom Color"
                        />
                      </div>
                    </div>

                    {/* Angle Buttons */}
                    <div className="control-block">
                      <span className="control-label">Orientation</span>
                      <div className="segmented-control">
                        <button
                          type="button"
                          className={`seg-btn ${wmAngle === 45 ? "active" : ""}`}
                          onClick={() => setWmAngle(45)}
                        >
                          Diagonal ↗
                        </button>
                        <button
                          type="button"
                          className={`seg-btn ${wmAngle === -45 ? "active" : ""}`}
                          onClick={() => setWmAngle(-45)}
                        >
                          Diagonal ↘
                        </button>
                        <button
                          type="button"
                          className={`seg-btn ${wmAngle === 0 ? "active" : ""}`}
                          onClick={() => setWmAngle(0)}
                        >
                          Horizontal →
                        </button>
                        <button
                          type="button"
                          className={`seg-btn ${wmAngle === 90 ? "active" : ""}`}
                          onClick={() => setWmAngle(90)}
                        >
                          Vertical ↑
                        </button>
                      </div>
                    </div>

                    {/* Font Size & Opacity */}
                    <div className="sliders-dual-grid">
                      <div className="slider-group">
                        <div className="slider-label-row">
                          <span>Size</span>
                          <span className="slider-val">{wmFontSize} pt</span>
                        </div>
                        <input
                          type="range"
                          min="18"
                          max="72"
                          value={wmFontSize}
                          onChange={(e) => setWmFontSize(Number(e.target.value))}
                          className="range-slider"
                        />
                      </div>

                      <div className="slider-group">
                        <div className="slider-label-row">
                          <span>Opacity</span>
                          <span className="slider-val">{Math.round(wmOpacity * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="10"
                          max="80"
                          value={Math.round(wmOpacity * 100)}
                          onChange={(e) => setWmOpacity(Number(e.target.value) / 100)}
                          className="range-slider"
                        />
                      </div>
                    </div>

                    {/* Tiling switch */}
                    <label className="checkbox-toggle-label">
                      <input
                        type="checkbox"
                        checked={wmTiled}
                        onChange={(e) => setWmTiled(e.target.checked)}
                      />
                      <span>Repeat across entire page (3x3 leak prevention grid)</span>
                    </label>
                  </>
                ) : (
                  /* Image / Logo Upload */
                  <div className="control-block">
                    <span className="control-label">Select Logo or Seal Image</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={handleImageUpload}
                      className="file-upload-input"
                    />
                    {wmImagePreview && (
                      <div className="image-preview-box">
                        <img src={wmImagePreview} alt="Watermark preview" className="uploaded-wm-thumb" />
                      </div>
                    )}
                    <div className="slider-group" style={{ marginTop: "12px" }}>
                      <div className="slider-label-row">
                        <span>Opacity</span>
                        <span className="slider-val">{Math.round(wmOpacity * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="80"
                        value={Math.round(wmOpacity * 100)}
                        onChange={(e) => setWmOpacity(Number(e.target.value) / 100)}
                        className="range-slider"
                      />
                    </div>
                  </div>
                )}

                {/* Page Scope */}
                <div className="control-block">
                  <span className="control-label">Apply To</span>
                  <div className="segmented-control">
                    <button
                      type="button"
                      className={`seg-btn ${wmScope === "all" ? "active" : ""}`}
                      onClick={() => setWmScope("all")}
                    >
                      All Pages
                    </button>
                    <button
                      type="button"
                      className={`seg-btn ${wmScope === "skipfirst" ? "active" : ""}`}
                      onClick={() => setWmScope("skipfirst")}
                    >
                      Skip Cover Page
                    </button>
                    <button
                      type="button"
                      className={`seg-btn ${wmScope === "first" ? "active" : ""}`}
                      onClick={() => setWmScope("first")}
                    >
                      First Page Only
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Page Numbers / Bates Controls */
              <div className="control-groups-wrap">
                {/* Format Presets */}
                <div className="control-block">
                  <span className="control-label">Numbering Style</span>
                  <div className="preset-chips-wrap">
                    {[
                      { label: "Page 1 of 12", val: "Page {page} of {total}" },
                      { label: "1 / 12", val: "{page} / {total}" },
                      { label: "- 1 -", val: "- {page} -" },
                      { label: "Page 1", val: "Page {page}" },
                      { label: "CONF-0001 (Bates)", val: "CONF-000{page}" },
                    ].map((p) => (
                      <button
                        key={p.val}
                        type="button"
                        className={`chip-btn ${pnFormat === p.val ? "active" : ""}`}
                        onClick={() => setPnFormat(p.val)}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Format Input */}
                <div className="control-block">
                  <label className="control-label" htmlFor="pn-format-input">Custom Template</label>
                  <input
                    id="pn-format-input"
                    type="text"
                    className="text-input-field"
                    value={pnFormat}
                    onChange={(e) => setPnFormat(e.target.value)}
                    placeholder="Use {page} and {total} tokens"
                  />
                </div>

                {/* 3x2 Position Matrix */}
                <div className="control-block">
                  <span className="control-label">Placement</span>
                  <div className="position-grid-3x2">
                    {[
                      { id: "topleft", label: "Top Left" },
                      { id: "topcenter", label: "Top Center" },
                      { id: "topright", label: "Top Right" },
                      { id: "bottomleft", label: "Bottom Left" },
                      { id: "bottomcenter", label: "Bottom Center" },
                      { id: "bottomright", label: "Bottom Right" },
                    ].map((pos) => (
                      <button
                        key={pos.id}
                        type="button"
                        className={`pos-grid-btn ${pnPosition === pos.id ? "active" : ""}`}
                        onClick={() => setPnPosition(pos.id as PageNumberPos)}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font Size & Margin Sliders */}
                <div className="sliders-dual-grid">
                  <div className="slider-group">
                    <div className="slider-label-row">
                      <span>Font Size</span>
                      <span className="slider-val">{pnFontSize} pt</span>
                    </div>
                    <input
                      type="range"
                      min="8"
                      max="16"
                      value={pnFontSize}
                      onChange={(e) => setPnFontSize(Number(e.target.value))}
                      className="range-slider"
                    />
                  </div>

                  <div className="slider-group">
                    <div className="slider-label-row">
                      <span>Margin Offset</span>
                      <span className="slider-val">{pnMargin} pt</span>
                    </div>
                    <input
                      type="range"
                      min="15"
                      max="60"
                      value={pnMargin}
                      onChange={(e) => setPnMargin(Number(e.target.value))}
                      className="range-slider"
                    />
                  </div>
                </div>

                {/* Color Swatches for Numbers */}
                <div className="control-block">
                  <span className="control-label">Number Color</span>
                  <div className="color-swatches-wrap">
                    {[
                      { name: "Executive Gray", hex: "#4b5563" },
                      { name: "Deep Charcoal", hex: "#111827" },
                      { name: "Navy Blue", hex: "#1d4ed8" },
                      { name: "Ruby Red", hex: "#dc2626" },
                    ].map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        className={`color-swatch ${pnColor === c.hex ? "selected" : ""}`}
                        style={{ backgroundColor: c.hex }}
                        onClick={() => setPnColor(c.hex)}
                        title={c.name}
                      />
                    ))}
                    <input
                      type="color"
                      className="custom-color-picker"
                      value={pnColor}
                      onChange={(e) => setPnColor(e.target.value)}
                      title="Custom Color"
                    />
                  </div>
                </div>

                {/* Start Page */}
                <div className="control-block">
                  <label className="control-label" htmlFor="pn-start-page">Start Numbering From Page</label>
                  <input
                    id="pn-start-page"
                    type="number"
                    min="1"
                    max={initialDoc.page_count}
                    value={pnStartPage}
                    onChange={(e) => setPnStartPage(Math.max(1, Number(e.target.value)))}
                    className="text-input-field"
                    style={{ width: "120px" }}
                  />
                  <span className="control-hint">Set to 2 to skip the title or cover page.</span>
                </div>
              </div>
            )}

            {/* Action Button */}
            <button
              type="button"
              className="btn-primary btn-action-large"
              disabled={isProcessing}
              onClick={handleApply}
            >
              {isProcessing ? (
                <>
                  <span className="spinner-sm" /> Processing...
                </>
              ) : subMode === "watermark" ? (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
                  </svg>
                  Apply Watermark
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Add Page Numbers
                </>
              )}
            </button>
          </div>

          {/* Right Column: Live Interactive Preview */}
          <div className="watermark-preview-card">
            <div className="preview-header">
              <span className="preview-title">Live Visual Preview</span>
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
                {initialDoc.page_count > 1 && (
                  <div className="preview-nav-controls">
                  <button
                    type="button"
                    className="btn-prev-page"
                    disabled={previewPage <= 1}
                    onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                  >
                    ‹
                  </button>
                  <span className="preview-page-counter">
                    Page {previewPage} of {initialDoc.page_count}
                  </span>
                  <button
                    type="button"
                    className="btn-next-page"
                    disabled={previewPage >= initialDoc.page_count}
                    onClick={() => setPreviewPage((p) => Math.min(initialDoc.page_count, p + 1))}
                  >
                    ›
                  </button>
                </div>
              )}
              </div>
            </div>

            <div className="canvas-preview-wrapper">
              <canvas ref={previewCanvasRef} className="pdf-base-canvas" />
              <canvas ref={overlayCanvasRef} className="pdf-overlay-canvas" />
            </div>
            <div className="preview-hint-bar">
              Changes to text, opacity, position, and styling update in real-time above.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
