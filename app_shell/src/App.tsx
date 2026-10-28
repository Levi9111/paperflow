import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { DropZone } from "./components/DropZone";
import { DocumentCard } from "./components/DocumentCard";
import { DocumentQueue } from "./components/DocumentQueue";
import { DestinationSelector } from "./components/DestinationSelector";
import { ActionFeedbackBanner, ActionFeedbackData } from "./components/ActionFeedbackBanner";
import { HistoryTab } from "./components/HistoryTab";
import { PdfViewer } from "./components/PdfViewer";
import { ToastContainer, ToastMessage } from "./components/Toast";
import { DocDetails, CompressDetails, DocumentMetadata, ToolType } from "./types/pdf";
import {
  formatBytes,
  generateDedicatedOutputPath,
  validatePageRanges,
} from "./utils/format";
import { getCachedDocDetails } from "./utils/docCache";
import {
  getDefaultOutputDir,
  addHistoryRecord,
  setPreferredOutputDir,
  getHistoryRecords,
} from "./utils/historyStore";
import { pickFiles } from "./utils/filePicker";
import { isTauriEnvironment } from "./utils/platform";
import "./App.css";

export default function App() {
  const [activeTool, setActiveTool] = useState<ToolType>("merge");

  // Output storage directory & history tracking
  const [outputDir, setOutputDir] = useState<string>("");
  const [historyCount, setHistoryCount] = useState<number>(() => getHistoryRecords().length);

  // Global window drag state
  const [isWindowDragging, setIsWindowDragging] = useState(false);

  // Minimal, non-intrusive toast notifications (single active at a time)
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (text: string, type: "info" | "success" | "warning" = "info") => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 5);
    setToasts([{ id, text, type }]);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Sync output directory and history badge on mount & updates
  useEffect(() => {
    getDefaultOutputDir().then((dir) => setOutputDir(dir));
    const handleHistoryUpdate = () => {
      setHistoryCount(getHistoryRecords().length);
    };
    window.addEventListener("paperflow_history_updated", handleHistoryUpdate);
    return () => window.removeEventListener("paperflow_history_updated", handleHistoryUpdate);
  }, []);

  // Merge state
  const [mergeDocs, setMergeDocs] = useState<DocDetails[]>([]);
  const [mergeOutput, setMergeOutput] = useState("");

  // Split state
  const [splitDoc, setSplitDoc] = useState<DocDetails | null>(null);
  const [splitMode, setSplitMode] = useState<"range" | "custom">("range");
  const [splitStartPage, setSplitStartPage] = useState(1);
  const [splitEndPage, setSplitEndPage] = useState(1);
  const [splitCustomRange, setSplitCustomRange] = useState("1-2");
  const [splitOutput, setSplitOutput] = useState("");

  // Split range validation
  const customRangeValidation = splitDoc
    ? validatePageRanges(splitCustomRange, splitDoc.page_count)
    : { valid: true, pages: [] };

  // Rotate state
  const [rotateDoc, setRotateDoc] = useState<DocDetails | null>(null);
  const [rotateDelta, setRotateDelta] = useState(90);
  const [rotateAll, setRotateAll] = useState(true);
  const [rotateTargetPage, setRotateTargetPage] = useState(1);
  const [rotateOutput, setRotateOutput] = useState("");

  // Compress state
  const [compressDoc, setCompressDoc] = useState<DocDetails | null>(null);
  const [compressPreset, setCompressPreset] = useState<"extreme" | "recommended" | "high">("recommended");
  const [compressOutput, setCompressOutput] = useState("");
  const [compressResult, setCompressResult] = useState<CompressDetails | null>(null);

  // Images to PDF state
  const [imagePaths, setImagePaths] = useState<string[]>([]);
  const [imgOutput, setImgOutput] = useState("");

  // Inspect & Sanitize state
  const [inspectDoc, setInspectDoc] = useState<DocDetails | null>(null);
  const [inspectMeta, setInspectMeta] = useState<DocumentMetadata | null>(null);
  const [sanitizeOutput, setSanitizeOutput] = useState("");

  // PDF Viewer state
  const [viewerPath, setViewerPath] = useState<string | null>(null);

  const handleViewPdf = (path: string) => {
    setViewerPath(path);
    setActiveTool("viewer");
  };

  // Processing & In-Place Action Feedback State
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<ActionFeedbackData | null>(null);

  // Reset feedback banner when changing tools to keep canvas calm and contextual
  useEffect(() => {
    setActionFeedback(null);
  }, [activeTool]);

  // Query document details helper (cached)
  const loadDocDetails = (path: string): Promise<DocDetails> => getCachedDocDetails(path);

  // Handle paths dropped via native window drag or dropzone
  const handleIncomingPaths = async (paths: string[]) => {
    if (!paths || paths.length === 0) return;

    if (activeTool === "merge") {
      const pdfs = paths.filter((p) => p.toLowerCase().endsWith(".pdf"));
      if (pdfs.length === 0) return;
      const loaded = await Promise.all(pdfs.map(loadDocDetails));
      setMergeDocs((prev) => {
        const next = [...prev, ...loaded];
        if (!mergeOutput && next.length > 0) {
          setMergeOutput(generateDedicatedOutputPath(outputDir, next[0].filename, "merged"));
        }
        return next;
      });
    } else if (activeTool === "split") {
      const pdf = paths.find((p) => p.toLowerCase().endsWith(".pdf"));
      if (!pdf) return;
      const details = await loadDocDetails(pdf);
      setSplitDoc(details);
      setSplitStartPage(1);
      setSplitEndPage(Math.min(details.page_count, 3));
      setSplitOutput(generateDedicatedOutputPath(outputDir, details.filename, "split"));
    } else if (activeTool === "rotate") {
      const pdf = paths.find((p) => p.toLowerCase().endsWith(".pdf"));
      if (!pdf) return;
      const details = await loadDocDetails(pdf);
      setRotateDoc(details);
      setRotateTargetPage(1);
      setRotateOutput(generateDedicatedOutputPath(outputDir, details.filename, "rotated"));
    } else if (activeTool === "compress") {
      const pdf = paths.find((p) => p.toLowerCase().endsWith(".pdf"));
      if (!pdf) return;
      const details = await loadDocDetails(pdf);
      setCompressDoc(details);
      setCompressResult(null);
      setCompressOutput(generateDedicatedOutputPath(outputDir, details.filename, "compressed"));
    } else if (activeTool === "img2pdf") {
      const validImages = paths.filter((p) => {
        const lower = p.toLowerCase();
        return (
          lower.endsWith(".png") ||
          lower.endsWith(".jpg") ||
          lower.endsWith(".jpeg") ||
          lower.endsWith(".webp")
        );
      });
      if (validImages.length === 0) return;
      setImagePaths((prev) => {
        const next = [...prev, ...validImages];
        if (!imgOutput && next.length > 0) {
          setImgOutput(generateDedicatedOutputPath(outputDir, "Converted_Images", "converted"));
        }
        return next;
      });
    } else if (activeTool === "inspect") {
      const pdf = paths.find((p) => p.toLowerCase().endsWith(".pdf"));
      if (!pdf) return;
      const details = await loadDocDetails(pdf);
      setInspectDoc(details);
      setSanitizeOutput(generateDedicatedOutputPath(outputDir, details.filename, "sanitized"));
      if (isTauriEnvironment()) {
        try {
          const meta = await invoke<DocumentMetadata>("get_metadata", { input: details.path });
          setInspectMeta(meta);
        } catch (e) {
          console.error("Failed to read metadata:", e);
        }
      } else {
        setInspectMeta({
          title: details.filename.replace(/\.pdf$/i, ""),
          author: "Local User",
          producer: "PaperFlow Studio (Browser Preview)",
          creator: "PaperFlow Desktop",
          version: "1.7",
          page_count: details.page_count,
          is_encrypted: false,
          creation_date: new Date().toLocaleDateString(),
        });
      }
    }
  };

  // Cross-navigation helper to preload files into tools from History
  const handleNavigateToTool = async (tool: ToolType, targetFilePath?: string) => {
    setActiveTool(tool);
    if (!targetFilePath) return;

    try {
      const details = await loadDocDetails(targetFilePath);
      if (tool === "compress") {
        setCompressDoc(details);
        setCompressResult(null);
        setCompressOutput(generateDedicatedOutputPath(outputDir, details.filename, "compressed"));
      } else if (tool === "split") {
        setSplitDoc(details);
        setSplitStartPage(1);
        setSplitEndPage(Math.min(details.page_count, 3));
        setSplitOutput(generateDedicatedOutputPath(outputDir, details.filename, "split"));
      } else if (tool === "rotate") {
        setRotateDoc(details);
        setRotateTargetPage(1);
        setRotateOutput(generateDedicatedOutputPath(outputDir, details.filename, "rotated"));
      } else if (tool === "inspect") {
        setInspectDoc(details);
        setSanitizeOutput(generateDedicatedOutputPath(outputDir, details.filename, "sanitized"));
      } else if (tool === "merge") {
        setMergeDocs((prev) => [...prev, details]);
        setMergeOutput(generateDedicatedOutputPath(outputDir, details.filename, "merged"));
      }
    } catch (err) {
      console.error("Failed to load document for tool navigation:", err);
    }
  };

  // Listen to window-level native file drop events from Tauri
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    try {
      getCurrentWebview()
        .onDragDropEvent((event) => {
          if (event.payload.type === "over" || event.payload.type === "enter") {
            setIsWindowDragging(true);
          } else if (event.payload.type === "leave") {
            setIsWindowDragging(false);
          } else if (event.payload.type === "drop") {
            setIsWindowDragging(false);
            if (event.payload.paths && event.payload.paths.length > 0) {
              handleIncomingPaths(event.payload.paths);
            }
          }
        })
        .then((fn) => {
          unlisten = fn;
        });
    } catch (e) {
      console.warn("Tauri drag-drop listener not supported in browser environment:", e);
    }

    return () => {
      if (unlisten) unlisten();
    };
  }, [activeTool, mergeOutput, imgOutput]);

  // Global keyboard shortcuts (Ctrl+1..7 for tools, Ctrl+O to browse, Esc to dismiss feedback)
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (actionFeedback && e.key === "Escape") {
        setActionFeedback(null);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key >= "1" && e.key <= "8") {
        e.preventDefault();
        const toolList: ToolType[] = [
          "merge",
          "split",
          "rotate",
          "compress",
          "img2pdf",
          "inspect",
          "viewer",
          "history",
        ];
        const idx = parseInt(e.key) - 1;
        if (toolList[idx]) {
          setActiveTool(toolList[idx]);
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === "o" || e.key === "O")) {
        e.preventDefault();
        try {
          const isImg = activeTool === "img2pdf";
          const extensions = isImg ? ["png", "jpg", "jpeg", "webp"] : ["pdf"];
          const paths = await pickFiles({
            multiple: activeTool === "merge" || isImg,
            acceptLabel: isImg ? "Images" : "PDF files",
            extensions,
          });
          if (paths && paths.length > 0) {
            handleIncomingPaths(paths);
          }
        } catch (err) {
          console.error("Keyboard shortcut open error:", err);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [actionFeedback, activeTool]);

  // Execute Merge
  const executeMerge = async () => {
    if (mergeDocs.length < 2) {
      setActionFeedback({
        type: "warning",
        title: "More Files Needed",
        message: "Please add at least 2 PDF documents to merge them together.",
      });
      return;
    }
    const targetOut =
      mergeOutput ||
      generateDedicatedOutputPath(outputDir, mergeDocs[0]?.filename || "Merged", "merged");

    // Strict non-destructive safeguard: never overwrite an original input
    if (mergeDocs.some((d) => d.path === targetOut)) {
      setActionFeedback({
        type: "warning",
        title: "Protected Input File",
        message:
          "The target output path matches one of your original input files. A separate new file must be created to protect your original documents.",
        outputPath: targetOut,
      });
      return;
    }

    setIsProcessing(true);
    try {
      let pageCount = 0;
      if (isTauriEnvironment()) {
        pageCount = await invoke<number>("pdf_merge", {
          inputs: mergeDocs.map((d) => d.path),
          output: targetOut,
        });
      } else {
        await new Promise((r) => setTimeout(r, 600));
        pageCount = mergeDocs.reduce((acc, d) => acc + (d.page_count || 1), 0);
      }

      const totalSize = mergeDocs.reduce((acc, d) => acc + d.file_size, 0);
      const outFilename = targetOut.split(/[/\\]/).pop() || "Merged.pdf";

      addHistoryRecord({
        outputPath: targetOut,
        filename: outFilename,
        action: "merge",
        actionLabel: `Merged ${mergeDocs.length} PDFs`,
        sourceFiles: mergeDocs.map((d) => d.path),
        fileSize: totalSize,
        pageCount,
      });

      // Prepare fresh timestamped path for the next merge operation
      setMergeOutput(
        generateDedicatedOutputPath(outputDir, mergeDocs[0]?.filename || "Merged", "merged")
      );

      setActionFeedback({
        type: "success",
        title: "Merge Complete",
        message: `Successfully combined ${mergeDocs.length} documents (${pageCount} total pages) into a new unified PDF.`,
        outputPath: targetOut,
        fileSize: totalSize,
        pageCount,
      });
    } catch (err: any) {
      setActionFeedback({
        type: "error",
        title: "Merge Failed",
        message: String(err),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Execute Split
  const executeSplit = async () => {
    if (!splitDoc) return;
    if (splitMode === "custom" && !customRangeValidation.valid) {
      setActionFeedback({
        type: "warning",
        title: "Invalid Page Range",
        message: customRangeValidation.error || "Please enter a valid page range (e.g. 1-3, 5).",
      });
      return;
    }
    const targetOut =
      splitOutput || generateDedicatedOutputPath(outputDir, splitDoc.filename, "split");

    if (splitDoc.path === targetOut) {
      setActionFeedback({
        type: "warning",
        title: "Protected Input File",
        message:
          "Target output file cannot be the same as your input file. A new file must be created to protect the original.",
        outputPath: targetOut,
      });
      return;
    }

    const rangeString =
      splitMode === "range" ? `${splitStartPage}-${splitEndPage}` : splitCustomRange;

    setIsProcessing(true);
    try {
      let pageCount = 0;
      if (isTauriEnvironment()) {
        pageCount = await invoke<number>("pdf_split", {
          input: splitDoc.path,
          ranges: rangeString,
          output: targetOut,
        });
      } else {
        await new Promise((r) => setTimeout(r, 600));
        pageCount =
          splitMode === "range"
            ? Math.max(1, splitEndPage - splitStartPage + 1)
            : customRangeValidation.pages.length || 1;
      }

      const outFilename = targetOut.split(/[/\\]/).pop() || "Split.pdf";

      addHistoryRecord({
        outputPath: targetOut,
        filename: outFilename,
        action: "split",
        actionLabel: `Split (${rangeString})`,
        sourceFiles: [splitDoc.path],
        fileSize: splitDoc.file_size,
        pageCount,
      });

      setSplitOutput(generateDedicatedOutputPath(outputDir, splitDoc.filename, "split"));

      setActionFeedback({
        type: "success",
        title: "Split Complete",
        message: `Extracted ${pageCount} pages (${rangeString}) into a newly created PDF document.`,
        outputPath: targetOut,
        pageCount,
      });
    } catch (err: any) {
      setActionFeedback({
        type: "error",
        title: "Split Failed",
        message: String(err),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Execute Rotate
  const executeRotate = async () => {
    if (!rotateDoc) return;
    const targetOut =
      rotateOutput || generateDedicatedOutputPath(outputDir, rotateDoc.filename, "rotated");

    if (rotateDoc.path === targetOut) {
      setActionFeedback({
        type: "warning",
        title: "Protected Input File",
        message:
          "Target output file cannot be the same as your input file. A new file must be created to protect the original.",
        outputPath: targetOut,
      });
      return;
    }

    setIsProcessing(true);
    try {
      if (isTauriEnvironment()) {
        if (rotateAll) {
          await invoke("pdf_rotate_all", {
            input: rotateDoc.path,
            angle: rotateDelta,
            output: targetOut,
          });
        } else {
          await invoke("pdf_rotate_page", {
            input: rotateDoc.path,
            page: rotateTargetPage,
            angle: rotateDelta,
            output: targetOut,
          });
        }
      } else {
        await new Promise((r) => setTimeout(r, 500));
      }

      const outFilename = targetOut.split(/[/\\]/).pop() || "Rotated.pdf";

      addHistoryRecord({
        outputPath: targetOut,
        filename: outFilename,
        action: "rotate",
        actionLabel: `Rotated ${rotateAll ? "all pages" : `p.${rotateTargetPage}`} by ${rotateDelta}°`,
        sourceFiles: [rotateDoc.path],
        fileSize: rotateDoc.file_size,
        pageCount: rotateDoc.page_count,
      });

      setRotateOutput(generateDedicatedOutputPath(outputDir, rotateDoc.filename, "rotated"));

      setActionFeedback({
        type: "success",
        title: "Rotation Saved",
        message: `Rotated ${
          rotateAll ? "all pages" : `page ${rotateTargetPage}`
        } by ${rotateDelta}° clockwise and saved as a new file.`,
        outputPath: targetOut,
        pageCount: rotateDoc.page_count,
      });
    } catch (err: any) {
      setActionFeedback({
        type: "error",
        title: "Rotation Failed",
        message: String(err),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Execute Compress
  const executeCompress = async () => {
    if (!compressDoc) return;
    const targetOut =
      compressOutput || generateDedicatedOutputPath(outputDir, compressDoc.filename, "compressed");

    if (compressDoc.path === targetOut) {
      setActionFeedback({
        type: "warning",
        title: "Protected Input File",
        message:
          "Target output file cannot be the same as your input file. A separate new file must be created.",
        outputPath: targetOut,
      });
      return;
    }

    setIsProcessing(true);
    try {
      let result: CompressDetails;
      if (isTauriEnvironment()) {
        result = await invoke<CompressDetails>("pdf_compress", {
          input: compressDoc.path,
          preset: compressPreset,
          output: targetOut,
        });
      } else {
        await new Promise((r) => setTimeout(r, 700));
        const factor =
          compressPreset === "extreme" ? 0.32 : compressPreset === "recommended" ? 0.52 : 0.78;
        const compSize = Math.round(compressDoc.file_size * factor);
        result = {
          original_size: compressDoc.file_size,
          compressed_size: compSize,
          ratio_percent: Math.round((1 - factor) * 100),
        };
      }
      setCompressResult(result);

      const outFilename = targetOut.split(/[/\\]/).pop() || "Compressed.pdf";

      addHistoryRecord({
        outputPath: targetOut,
        filename: outFilename,
        action: "compress",
        actionLabel: `Compressed (${result.ratio_percent.toFixed(1)}% saved)`,
        sourceFiles: [compressDoc.path],
        fileSize: result.compressed_size,
        pageCount: compressDoc.page_count,
      });

      setCompressOutput(
        generateDedicatedOutputPath(outputDir, compressDoc.filename, "compressed")
      );

      setActionFeedback({
        type: "success",
        title: "Compression Successful",
        message: `Reduced file size by ${result.ratio_percent.toFixed(1)}% (${formatBytes(
          result.original_size
        )} → ${formatBytes(result.compressed_size)}) and saved to PaperFlow outputs.`,
        outputPath: targetOut,
        fileSize: result.compressed_size,
        pageCount: compressDoc.page_count,
      });
    } catch (err: any) {
      setActionFeedback({
        type: "error",
        title: "Compression Failed",
        message: String(err),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Execute Images to PDF
  const executeImg2Pdf = async () => {
    if (imagePaths.length === 0) return;
    const targetOut =
      imgOutput || generateDedicatedOutputPath(outputDir, "Converted_Images", "converted");
    setIsProcessing(true);
    try {
      let pageCount = 0;
      if (isTauriEnvironment()) {
        pageCount = await invoke<number>("pdf_img2pdf", {
          inputs: imagePaths,
          output: targetOut,
        });
      } else {
        await new Promise((r) => setTimeout(r, 600));
        pageCount = imagePaths.length;
      }

      const outFilename = targetOut.split(/[/\\]/).pop() || "Converted.pdf";

      addHistoryRecord({
        outputPath: targetOut,
        filename: outFilename,
        action: "img2pdf",
        actionLabel: `From ${imagePaths.length} images`,
        sourceFiles: imagePaths,
        fileSize: 0,
        pageCount,
      });

      setImgOutput(generateDedicatedOutputPath(outputDir, "Converted_Images", "converted"));

      setActionFeedback({
        type: "success",
        title: "Images Converted",
        message: `Generated a high-resolution ${pageCount}-page PDF document from ${imagePaths.length} images.`,
        outputPath: targetOut,
        pageCount,
      });
    } catch (err: any) {
      setActionFeedback({
        type: "error",
        title: "Conversion Failed",
        message: String(err),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Execute Sanitize Metadata
  const executeSanitize = async () => {
    if (!inspectDoc) return;
    const targetOut =
      sanitizeOutput || generateDedicatedOutputPath(outputDir, inspectDoc.filename, "sanitized");

    if (inspectDoc.path === targetOut) {
      setActionFeedback({
        type: "warning",
        title: "Protected Input File",
        message:
          "Target output file cannot be the same as your input file. A new file must be created to protect the original.",
        outputPath: targetOut,
      });
      return;
    }

    setIsProcessing(true);
    try {
      if (isTauriEnvironment()) {
        await invoke("pdf_sanitize_meta", {
          input: inspectDoc.path,
          output: targetOut,
        });
      } else {
        await new Promise((r) => setTimeout(r, 500));
      }

      const outFilename = targetOut.split(/[/\\]/).pop() || "Sanitized.pdf";

      addHistoryRecord({
        outputPath: targetOut,
        filename: outFilename,
        action: "sanitize",
        actionLabel: "Sanitized metadata",
        sourceFiles: [inspectDoc.path],
        fileSize: inspectDoc.file_size,
        pageCount: inspectDoc.page_count,
      });

      setSanitizeOutput(
        generateDedicatedOutputPath(outputDir, inspectDoc.filename, "sanitized")
      );

      setActionFeedback({
        type: "success",
        title: "Metadata Cleared",
        message: "Saved a clean copy of your document with author and software details removed.",
        outputPath: targetOut,
        pageCount: inspectDoc.page_count,
      });
    } catch (err: any) {
      setActionFeedback({
        type: "error",
        title: "Sanitize Failed",
        message: String(err),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Navigation tabs config
  const tools: { id: ToolType; label: string; icon: React.ReactNode; badge?: string }[] = [
    {
      id: "merge",
      label: "Merge PDFs",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
        </svg>
      ),
    },
    {
      id: "split",
      label: "Split PDF",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="6" cy="6" r="3" />
          <path d="M8.12 8.12 12 12" />
          <path d="M20 4 8.12 15.88" />
          <circle cx="6" cy="18" r="3" />
          <path d="M14.8 14.8 20 20" />
        </svg>
      ),
    },
    {
      id: "rotate",
      label: "Rotate Pages",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
        </svg>
      ),
    },
    {
      id: "compress",
      label: "Compress PDF",
      badge: "Core",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m14 12-4-4-4 4" />
          <path d="M10 8v12" />
          <rect width="20" height="5" x="2" y="2" rx="2" />
          <rect width="20" height="5" x="2" y="17" rx="2" />
        </svg>
      ),
    },
    {
      id: "img2pdf",
      label: "Images to PDF",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </svg>
      ),
    },
    {
      id: "inspect",
      label: "Inspect & Sanitize",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      ),
    },
    {
      id: "viewer",
      label: "PDF Viewer",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ),
    },
    {
      id: "history",
      label: "Work History",
      badge: historyCount > 0 ? String(historyCount) : undefined,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
  ];

  return (
    <div className={`app-shell ${isWindowDragging ? "window-drag-active" : ""}`}>
      {/* Window-wide drag overlay */}
      {isWindowDragging && (
        <div className="global-drag-overlay">
          <div className="drag-overlay-box">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
              <path d="M12 12v9" />
              <path d="m8 16 4-4 4 4" />
            </svg>
            <h2>Drop to Load Files into PaperFlow</h2>
            <p>Drop your files to begin</p>
          </div>
        </div>
      )}

      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="/logo.jpg" alt="PaperFlow Logo" className="brand-logo" />
          <div className="brand-text">
            <h1 className="brand-name">PaperFlow</h1>
            <span className="brand-badge">PDF Studio</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-group-label">PDF Tools</div>
          {tools.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`nav-item ${activeTool === t.id ? "active" : ""}`}
              onClick={() => setActiveTool(t.id)}
            >
              <span className="nav-icon">{t.icon}</span>
              <span className="nav-label">{t.label}</span>
              {t.badge && <span className="nav-chip">{t.badge}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-version-tag">Version 0.1.0</div>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <main className="workspace">
        {/* Top Header */}
        <header className="workspace-header">
          <div className="header-titles" key={activeTool}>
            <h2 className="tool-title">
              {tools.find((t) => t.id === activeTool)?.label}
            </h2>
            <p className="tool-description">
              {activeTool === "merge" &&
                "Combine multiple PDFs into one document in your preferred order."}
              {activeTool === "split" &&
                "Extract specific pages or page ranges into a separate document."}
              {activeTool === "rotate" &&
                "Rotate specific pages or entire documents to the correct orientation."}
              {activeTool === "compress" &&
                "Reduce PDF file size by optimizing document streams and removing redundancy."}
              {activeTool === "img2pdf" &&
                "Convert images into a unified PDF document."}
              {activeTool === "inspect" &&
                "View document properties or clear author and software metadata."}
              {activeTool === "viewer" &&
                "Preview, read, and navigate PDF documents with fluid zoom and page thumbnails."}
              {activeTool === "history" &&
                "Access, search, and manage your generated documents in one place."}
            </p>
          </div>
        </header>

        {/* Dynamic Tool Content */}
        <section className="tool-canvas">
          {/* Non-blocking In-Place Action Feedback */}
          <ActionFeedbackBanner
            feedback={actionFeedback}
            onDismiss={() => setActionFeedback(null)}
            onViewHistory={() => setActiveTool("history")}
            onViewPdf={handleViewPdf}
          />

          {/* ================= MERGE TOOL ================= */}
          {activeTool === "merge" && (
            <div className="tool-card-view" key="merge">
              {mergeDocs.length === 0 ? (
                <DropZone
                  multiple
                  title="Drag & drop PDF files to merge"
                  subtitle="Drop multiple documents here or click to browse"
                  onFilesSelected={handleIncomingPaths}
                />
              ) : (
                <div className="tool-active-pane">
                  <DocumentQueue
                    documents={mergeDocs}
                    onRemove={(idx) => {
                      const next = mergeDocs.filter((_, i) => i !== idx);
                      setMergeDocs(next);
                      if (next.length === 0) setMergeOutput("");
                    }}
                    onMoveUp={(idx) => {
                      if (idx === 0) return;
                      const next = [...mergeDocs];
                      const temp = next[idx - 1];
                      next[idx - 1] = next[idx];
                      next[idx] = temp;
                      setMergeDocs(next);
                    }}
                    onMoveDown={(idx) => {
                      if (idx === mergeDocs.length - 1) return;
                      const next = [...mergeDocs];
                      const temp = next[idx + 1];
                      next[idx + 1] = next[idx];
                      next[idx] = temp;
                      setMergeDocs(next);
                    }}
                    onAddMore={async () => {
                      const paths = await pickFiles({
                        multiple: true,
                        acceptLabel: "PDF files",
                        extensions: ["pdf"],
                      });
                      if (paths.length > 0) {
                        handleIncomingPaths(paths);
                      }
                    }}
                    onClear={() => {
                      setMergeDocs([]);
                      setMergeOutput("");
                    }}
                  />

                  <DestinationSelector
                    outputPath={mergeOutput}
                    defaultFilename="merged_document.pdf"
                    onChange={setMergeOutput}
                  />

                  <div className="action-row">
                    <button
                      type="button"
                      className="btn-primary-action"
                      disabled={isProcessing || mergeDocs.length < 2}
                      onClick={executeMerge}
                    >
                      {isProcessing ? (
                        <span className="spinner-label">
                          <span className="spinner" /> Merging Documents...
                        </span>
                      ) : (
                        `Merge ${mergeDocs.length} PDFs`
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= SPLIT TOOL ================= */}
          {activeTool === "split" && (
            <div className="tool-card-view" key="split">
              {!splitDoc ? (
                <DropZone
                  multiple={false}
                  title="Drag & drop a PDF file to split"
                  subtitle="Extract pages, split ranges, or isolate chapters"
                  onFilesSelected={handleIncomingPaths}
                />
              ) : (
                <div className="tool-active-pane">
                  <DocumentCard
                    doc={splitDoc}
                    onRemove={() => setSplitDoc(null)}
                    onChangeFile={async () => {
                      const paths = await pickFiles({
                        multiple: false,
                        acceptLabel: "PDF files",
                        extensions: ["pdf"],
                      });
                      if (paths.length > 0) {
                        handleIncomingPaths(paths);
                      }
                    }}
                  />

                  <div className="options-panel">
                    <h4 className="panel-title">Split Configuration</h4>
                    <div className="mode-toggle-group">
                      <button
                        type="button"
                        className={`mode-toggle-btn ${splitMode === "range" ? "active" : ""}`}
                        onClick={() => setSplitMode("range")}
                      >
                        Sequential Range
                      </button>
                      <button
                        type="button"
                        className={`mode-toggle-btn ${splitMode === "custom" ? "active" : ""}`}
                        onClick={() => setSplitMode("custom")}
                      >
                        Custom Page List
                      </button>
                    </div>

                    {splitMode === "range" ? (
                      <div className="range-controls-row">
                        <div className="input-group">
                          <label className="field-label">Start Page</label>
                          <input
                            type="number"
                            className="input-number"
                            min={1}
                            max={splitDoc.page_count}
                            value={splitStartPage}
                            onChange={(e) =>
                              setSplitStartPage(Math.max(1, parseInt(e.target.value) || 1))
                            }
                          />
                        </div>
                        <div className="range-divider">to</div>
                        <div className="input-group">
                          <label className="field-label">End Page</label>
                          <input
                            type="number"
                            className="input-number"
                            min={splitStartPage}
                            max={splitDoc.page_count}
                            value={splitEndPage}
                            onChange={(e) =>
                              setSplitEndPage(
                                Math.min(
                                  splitDoc.page_count,
                                  Math.max(splitStartPage, parseInt(e.target.value) || 1)
                                )
                              )
                            }
                          />
                        </div>
                        <span className="range-hint">
                          (Extracting {Math.max(0, splitEndPage - splitStartPage + 1)} of{" "}
                          {splitDoc.page_count} pages)
                        </span>
                      </div>
                    ) : (
                      <div className="input-group">
                        <label className="field-label">
                          Page numbers and ranges (e.g., 1-3, 5, 8-10)
                        </label>
                        <input
                          type="text"
                          className="input-text"
                          value={splitCustomRange}
                          onChange={(e) => setSplitCustomRange(e.target.value)}
                          placeholder="e.g. 1-3, 5, 8"
                        />
                        {splitCustomRange.trim() && (
                          <div
                            className={`range-status-badge ${
                              customRangeValidation.valid ? "valid" : "invalid"
                            }`}
                          >
                            {customRangeValidation.valid ? (
                              <span>
                                ✓ {customRangeValidation.pages.length} page
                                {customRangeValidation.pages.length > 1 ? "s" : ""} selected (
                                {customRangeValidation.pages.slice(0, 6).join(", ")}
                                {customRangeValidation.pages.length > 6 ? "..." : ""})
                              </span>
                            ) : (
                              <span>⚠ {customRangeValidation.error}</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <DestinationSelector
                    outputPath={splitOutput}
                    defaultFilename={`${splitDoc.filename.replace(/\.pdf$/i, "")}_split.pdf`}
                    onChange={setSplitOutput}
                  />

                  <div className="action-row">
                    <button
                      type="button"
                      className="btn-primary-action"
                      disabled={isProcessing || (splitMode === "custom" && !customRangeValidation.valid)}
                      onClick={executeSplit}
                    >
                      {isProcessing ? (
                        <span className="spinner-label">
                          <span className="spinner" /> Extracting Pages...
                        </span>
                      ) : (
                        "Extract & Save Pages"
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= ROTATE TOOL ================= */}
          {activeTool === "rotate" && (
            <div className="tool-card-view" key="rotate">
              {!rotateDoc ? (
                <DropZone
                  multiple={false}
                  title="Drag & drop a PDF file to rotate"
                  subtitle="Change orientation of upside-down or sideways scans"
                  onFilesSelected={handleIncomingPaths}
                />
              ) : (
                <div className="tool-active-pane">
                  <DocumentCard
                    doc={rotateDoc}
                    onRemove={() => setRotateDoc(null)}
                  />

                  <div className="rotate-interactive-stage">
                    {/* Visual Animated Preview Card */}
                    <div className="rotate-preview-container">
                      <div
                        className="rotate-preview-sheet"
                        style={{
                          transform: `rotate(${rotateDelta}deg)`,
                          transition: "transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
                        }}
                      >
                        <div className="sheet-header">
                          <span className="sheet-pill" />
                          <span className="sheet-stamp">TOP</span>
                        </div>
                        <div className="sheet-lines">
                          <div className="sheet-line long" />
                          <div className="sheet-line med" />
                          <div className="sheet-line short" />
                        </div>
                        <div className="sheet-footer">
                          <span>PaperFlow Scan Preview</span>
                        </div>
                      </div>
                      <span className="rotate-angle-badge">{rotateDelta}° Clockwise</span>
                    </div>

                    {/* Rotation Controls */}
                    <div className="rotate-controls-column">
                      <label className="field-label">Select Rotation Angle</label>
                      <div className="rotate-angle-buttons">
                        <button
                          type="button"
                          className={`btn-angle ${rotateDelta === 90 ? "active" : ""}`}
                          onClick={() => setRotateDelta(90)}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                          </svg>
                          90° Right
                        </button>
                        <button
                          type="button"
                          className={`btn-angle ${rotateDelta === 180 ? "active" : ""}`}
                          onClick={() => setRotateDelta(180)}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M7 16V4m0 0L3 8m4-4 4 4M17 8v12m0 0 4-4m-4 4-4-4" />
                          </svg>
                          180° Flip
                        </button>
                        <button
                          type="button"
                          className={`btn-angle ${rotateDelta === 270 ? "active" : ""}`}
                          onClick={() => setRotateDelta(270)}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M2.5 2v6h6M2.66 15.57a10 10 0 1 0 .57-8.38L-2.44 1.52" />
                          </svg>
                          90° Left (270°)
                        </button>
                      </div>

                      <label className="field-label" style={{ marginTop: "16px" }}>
                        Application Scope
                      </label>
                      <div className="scope-selection-row">
                        <label className="radio-pill-label">
                          <input
                            type="radio"
                            name="rotateScope"
                            checked={rotateAll}
                            onChange={() => setRotateAll(true)}
                          />
                          <span>All {rotateDoc.page_count} Pages</span>
                        </label>
                        <label className="radio-pill-label">
                          <input
                            type="radio"
                            name="rotateScope"
                            checked={!rotateAll}
                            onChange={() => setRotateAll(false)}
                          />
                          <span>Specific Page</span>
                        </label>
                        {!rotateAll && (
                          <input
                            type="number"
                            className="input-number-small"
                            min={1}
                            max={rotateDoc.page_count}
                            value={rotateTargetPage}
                            onChange={(e) =>
                              setRotateTargetPage(
                                Math.min(
                                  rotateDoc.page_count,
                                  Math.max(1, parseInt(e.target.value) || 1)
                                )
                              )
                            }
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  <DestinationSelector
                    outputPath={rotateOutput}
                    defaultFilename={`${rotateDoc.filename.replace(/\.pdf$/i, "")}_rotated.pdf`}
                    onChange={setRotateOutput}
                  />

                  <div className="action-row">
                    <button
                      type="button"
                      className="btn-primary-action"
                      disabled={isProcessing}
                      onClick={executeRotate}
                    >
                      {isProcessing ? (
                        <span className="spinner-label">
                          <span className="spinner" /> Rotating Pages...
                        </span>
                      ) : (
                        "Rotate & Save Document"
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= COMPRESS TOOL ================= */}
          {activeTool === "compress" && (
            <div className="tool-card-view" key="compress">
              {!compressDoc ? (
                <DropZone
                  multiple={false}
                  title="Drag & drop a PDF file to compress"
                  subtitle="Deduplicate objects, remove metadata, and shrink file size"
                  onFilesSelected={handleIncomingPaths}
                />
              ) : (
                <div className="tool-active-pane">
                  <DocumentCard
                    doc={compressDoc}
                    onRemove={() => {
                      setCompressDoc(null);
                      setCompressResult(null);
                    }}
                  />

                  <div className="options-panel">
                    <h4 className="panel-title">Compression Profile</h4>
                    <div className="preset-cards-grid">
                      <div
                        className={`preset-card ${compressPreset === "extreme" ? "active" : ""}`}
                        onClick={() => setCompressPreset("extreme")}
                      >
                        <div className="preset-badge red">Maximum Reduction</div>
                        <h5 className="preset-name">Extreme Compression</h5>
                        <p className="preset-desc">
                          Deep object deduplication and complete metadata stripping. Smallest file size.
                        </p>
                        <span className="preset-est">~60-75% Savings</span>
                      </div>

                      <div
                        className={`preset-card ${compressPreset === "recommended" ? "active" : ""}`}
                        onClick={() => setCompressPreset("recommended")}
                      >
                        <div className="preset-badge green">Recommended</div>
                        <h5 className="preset-name">Balanced Optimization</h5>
                        <p className="preset-desc">
                          Lossless stream compression and duplicate dictionary merging without visual compromise.
                        </p>
                        <span className="preset-est">~40-50% Savings</span>
                      </div>

                      <div
                        className={`preset-card ${compressPreset === "high" ? "active" : ""}`}
                        onClick={() => setCompressPreset("high")}
                      >
                        <div className="preset-badge blue">High Fidelity</div>
                        <h5 className="preset-name">High Quality</h5>
                        <p className="preset-desc">
                          Light compression preserving original metadata, vectors, and font tables intact.
                        </p>
                        <span className="preset-est">~20-30% Savings</span>
                      </div>
                    </div>
                  </div>

                  {compressResult && (
                    <div className="compression-stats-banner">
                      <div className="stat-box">
                        <span className="stat-label">Original Size</span>
                        <span className="stat-val">{formatBytes(compressResult.original_size)}</span>
                      </div>
                      <div className="stat-arrow">→</div>
                      <div className="stat-box highlight">
                        <span className="stat-label">Optimized Size</span>
                        <span className="stat-val">{formatBytes(compressResult.compressed_size)}</span>
                      </div>
                      <div className="stat-badge-savings">
                        Saved {compressResult.ratio_percent.toFixed(1)}%
                      </div>
                    </div>
                  )}

                  <DestinationSelector
                    outputPath={compressOutput}
                    defaultFilename={`${compressDoc.filename.replace(/\.pdf$/i, "")}_compressed.pdf`}
                    onChange={setCompressOutput}
                  />

                  <div className="action-row">
                    <button
                      type="button"
                      className="btn-primary-action"
                      disabled={isProcessing}
                      onClick={executeCompress}
                    >
                      {isProcessing ? (
                        <span className="spinner-label">
                          <span className="spinner" /> Optimizing PDF...
                        </span>
                      ) : (
                        "Compress PDF"
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= IMAGES TO PDF TOOL ================= */}
          {activeTool === "img2pdf" && (
            <div className="tool-card-view" key="img2pdf">
              {imagePaths.length === 0 ? (
                <DropZone
                  multiple
                  acceptLabel="Image files (PNG, JPG, WebP)"
                  extensions={["png", "jpg", "jpeg", "webp"]}
                  title="Drag & drop images to convert to PDF"
                  subtitle="Drop PNG, JPEG, or WebP photos to build a unified PDF"
                  onFilesSelected={handleIncomingPaths}
                />
              ) : (
                <div className="tool-active-pane">
                  <div className="image-queue-header">
                    <span className="queue-title">Selected Images ({imagePaths.length})</span>
                    <button
                      type="button"
                      className="btn-queue-add"
                      onClick={async () => {
                        const paths = await pickFiles({
                          multiple: true,
                          acceptLabel: "Images",
                          extensions: ["png", "jpg", "jpeg", "webp"],
                        });
                        if (paths.length > 0) {
                          handleIncomingPaths(paths);
                        }
                      }}
                    >
                      + Add More Images
                    </button>
                  </div>

                  <div className="image-grid-preview">
                    {imagePaths.map((p, idx) => (
                      <div key={`${p}-${idx}`} className="image-preview-card">
                        <div className="image-card-badge">{idx + 1}</div>
                        <div className="image-card-filename" title={p}>
                          {p.replace(/\\/g, "/").split("/").pop()}
                        </div>
                        <button
                          type="button"
                          className="btn-remove-thumb"
                          onClick={() => {
                            const next = imagePaths.filter((_, i) => i !== idx);
                            setImagePaths(next);
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  <DestinationSelector
                    outputPath={imgOutput}
                    defaultFilename="converted_images.pdf"
                    onChange={setImgOutput}
                  />

                  <div className="action-row">
                    <button
                      type="button"
                      className="btn-primary-action"
                      disabled={isProcessing || imagePaths.length === 0}
                      onClick={executeImg2Pdf}
                    >
                      {isProcessing ? (
                        <span className="spinner-label">
                          <span className="spinner" /> Generating PDF...
                        </span>
                      ) : (
                        `Convert ${imagePaths.length} Images to PDF`
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= INSPECT & SANITIZE TOOL ================= */}
          {activeTool === "inspect" && (
            <div className="tool-card-view" key="inspect">
              {!inspectDoc ? (
                <DropZone
                  multiple={false}
                  title="Drag & drop a PDF to inspect properties"
                  subtitle="View document information or remove author and software details"
                  onFilesSelected={handleIncomingPaths}
                />
              ) : (
                <div className="tool-active-pane">
                  <DocumentCard
                    doc={inspectDoc}
                    onRemove={() => {
                      setInspectDoc(null);
                      setInspectMeta(null);
                    }}
                  />

                  <div className="options-panel">
                    <div className="panel-header-with-badge">
                      <h4 className="panel-title">Document Properties</h4>
                      <span className="audit-badge">
                        {inspectMeta?.author || inspectMeta?.creator
                          ? "Metadata Present"
                          : "Empty"}
                      </span>
                    </div>

                    <div className="meta-grid">
                      <div className="meta-cell">
                        <span className="meta-k">Title</span>
                        <span className="meta-v">{inspectMeta?.title || "—"}</span>
                      </div>
                      <div className="meta-cell">
                        <span className="meta-k">Author</span>
                        <span className="meta-v">{inspectMeta?.author || "—"}</span>
                      </div>
                      <div className="meta-cell">
                        <span className="meta-k">Creator Software</span>
                        <span className="meta-v">{inspectMeta?.creator || "—"}</span>
                      </div>
                      <div className="meta-cell">
                        <span className="meta-k">PDF Producer</span>
                        <span className="meta-v">{inspectMeta?.producer || "—"}</span>
                      </div>
                      <div className="meta-cell">
                        <span className="meta-k">Creation Date</span>
                        <span className="meta-v">{inspectMeta?.creation_date || "—"}</span>
                      </div>
                      <div className="meta-cell">
                        <span className="meta-k">Subject</span>
                        <span className="meta-v">{inspectMeta?.subject || "—"}</span>
                      </div>
                      <div className="meta-cell">
                        <span className="meta-k">PDF Version</span>
                        <span className="meta-v">{inspectMeta?.version ? `PDF ${inspectMeta.version}` : "—"}</span>
                      </div>
                      <div className="meta-cell">
                        <span className="meta-k">Encryption / Password</span>
                        <span className="meta-v">{inspectMeta?.is_encrypted ? "Protected / Encrypted" : "Unencrypted"}</span>
                      </div>
                    </div>
                  </div>

                  <DestinationSelector
                    outputPath={sanitizeOutput}
                    defaultFilename={`${inspectDoc.filename.replace(/\.pdf$/i, "")}_clean.pdf`}
                    onChange={setSanitizeOutput}
                    label="Cleaned Output Destination"
                  />

                  <div className="action-row">
                    <button
                      type="button"
                      className="btn-primary-action"
                      disabled={isProcessing}
                      onClick={executeSanitize}
                    >
                      {isProcessing ? (
                        <span className="spinner-label">
                          <span className="spinner" /> Cleaning Document...
                        </span>
                      ) : (
                        "Clear Metadata & Save"
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= PDF VIEWER TAB ================= */}
          {activeTool === "viewer" && (
            <PdfViewer
              filePath={viewerPath}
              onClose={() => setActiveTool("history")}
              onNavigateToTool={handleNavigateToTool}
              onSelectFile={async () => {
                const paths = await pickFiles({
                  multiple: false,
                  acceptLabel: "PDF files",
                  extensions: ["pdf"],
                });
                if (paths && paths[0]) {
                  setViewerPath(paths[0]);
                }
              }}
            />
          )}

          {/* ================= WORK HISTORY TAB ================= */}
          {activeTool === "history" && (
            <HistoryTab
              outputDir={outputDir}
              onOutputDirChange={(newDir) => {
                setOutputDir(newDir);
                setPreferredOutputDir(newDir);
              }}
              onNavigateToTool={handleNavigateToTool}
              onViewPdf={handleViewPdf}
              onShowToast={showToast}
            />
          )}
        </section>
      </main>

      {/* Minimal Toast Alerts */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
