import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { ProcessedFileRecord, ToolType } from "../types/pdf";
import {
  getHistoryRecords,
  removeHistoryRecord,
  clearHistory,
  setPreferredOutputDir,
  syncWithDisk,
} from "../utils/historyStore";
import { formatBytes, formatDate } from "../utils/format";
import { isTauriEnvironment } from "../utils/platform";

interface HistoryTabProps {
  outputDir: string;
  onOutputDirChange: (newDir: string) => void;
  onNavigateToTool: (tool: ToolType, targetFilePath?: string) => void;
  onShowToast: (msg: string, type: "info" | "success" | "warning") => void;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({
  outputDir,
  onOutputDirChange,
  onNavigateToTool,
  onShowToast,
}) => {
  const [records, setRecords] = useState<ProcessedFileRecord[]>([]);
  const [filterAction, setFilterAction] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const loadRecords = () => {
    setRecords(getHistoryRecords());
  };

  useEffect(() => {
    loadRecords();

    const handleUpdate = () => loadRecords();
    window.addEventListener("paperflow_history_updated", handleUpdate);
    return () => window.removeEventListener("paperflow_history_updated", handleUpdate);
  }, []);

  const handleRescan = async () => {
    setIsScanning(true);
    try {
      const synced = await syncWithDisk(outputDir);
      setRecords(synced);
      onShowToast("Synced work folder with disk", "info");
    } catch (e) {
      console.error(e);
    } finally {
      setIsScanning(false);
    }
  };

  const handleOpenFolder = async () => {
    if (!outputDir) return;
    if (isTauriEnvironment()) {
      try {
        await invoke("open_folder", { path: outputDir });
      } catch (err) {
        onShowToast(`Failed to open folder: ${err}`, "warning");
      }
    } else {
      onShowToast(`Work directory: ${outputDir}`, "info");
    }
  };

  const handleChangeFolder = async () => {
    if (isTauriEnvironment()) {
      try {
        const selected = await open({
          directory: true,
          multiple: false,
          defaultPath: outputDir,
        });
        if (selected && typeof selected === "string") {
          onOutputDirChange(selected);
          setPreferredOutputDir(selected);
          onShowToast(`Output folder set to: ${selected}`, "success");
          return;
        }
      } catch (err) {
        console.warn("Folder picker error:", err);
      }
    }

    const manual = window.prompt("Enter new folder path to store all outputs:", outputDir);
    if (manual && manual.trim()) {
      onOutputDirChange(manual.trim());
      setPreferredOutputDir(manual.trim());
      onShowToast(`Output folder set to: ${manual.trim()}`, "success");
    }
  };

  const handleOpenFile = async (record: ProcessedFileRecord) => {
    if (isTauriEnvironment()) {
      try {
        await invoke("open_file", { path: record.outputPath });
      } catch (err) {
        onShowToast(`Could not open file: ${err}`, "warning");
      }
    } else {
      window.open(record.outputPath, "_blank");
    }
  };

  const handleRevealInFolder = async (record: ProcessedFileRecord) => {
    if (isTauriEnvironment()) {
      try {
        await invoke("open_folder", { path: record.outputPath });
      } catch (err) {
        onShowToast(`Could not open folder: ${err}`, "warning");
      }
    } else {
      onShowToast(`Location: ${record.outputPath}`, "info");
    }
  };

  const handleCopyPath = async (record: ProcessedFileRecord) => {
    try {
      await navigator.clipboard.writeText(record.outputPath);
      setCopiedId(record.id);
      setTimeout(() => setCopiedId(null), 2000);
      onShowToast("File path copied to clipboard", "success");
    } catch {
      onShowToast("Failed to copy path", "warning");
    }
  };

  const handleDeleteRecord = async (record: ProcessedFileRecord) => {
    const shouldDeleteFromDisk = window.confirm(
      `Delete "${record.filename}"?\n\nClick OK to also remove the file from your computer disk.`
    );
    if (!shouldDeleteFromDisk) return;

    if (isTauriEnvironment()) {
      try {
        await invoke("delete_file", { path: record.outputPath });
      } catch (err) {
        console.warn("Could not delete from disk:", err);
      }
    }
    removeHistoryRecord(record.id);
    onShowToast(`Removed ${record.filename}`, "info");
  };

  const handleClearAll = () => {
    if (records.length === 0) return;
    if (window.confirm("Clear all work history entries? (Files on disk will NOT be deleted)")) {
      clearHistory();
      onShowToast("History log cleared", "info");
    }
  };

  const filteredRecords = records.filter((r) => {
    if (filterAction !== "all" && r.action !== filterAction) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const inFilename = r.filename.toLowerCase().includes(q);
      const inOutput = r.outputPath.toLowerCase().includes(q);
      const inSources = r.sourceFiles?.some((s) => s.toLowerCase().includes(q));
      if (!inFilename && !inOutput && !inSources) return false;
    }
    return true;
  });

  const getActionBadgeClass = (action: string) => {
    switch (action) {
      case "merge":
        return "badge-action-merge";
      case "split":
        return "badge-action-split";
      case "rotate":
        return "badge-action-rotate";
      case "compress":
        return "badge-action-compress";
      case "img2pdf":
        return "badge-action-img2pdf";
      case "sanitize":
        return "badge-action-sanitize";
      default:
        return "badge-action-default";
    }
  };

  const totalBytes = records.reduce((acc, r) => acc + (r.fileSize || 0), 0);

  return (
    <div className="history-tab-container">
      {/* Top Banner: Output Directory Details */}
      <div className="history-folder-card">
        <div className="folder-card-header">
          <div className="folder-icon-box">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div className="folder-card-info">
            <div className="folder-card-title-row">
              <span className="folder-card-title">Dedicated Output Storage</span>
              <span className="folder-badge-guarantee">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Originals Always Protected
              </span>
            </div>
            <div className="folder-path-display" title={outputDir}>
              {outputDir || "Resolving dedicated folder..."}
            </div>
            <p className="folder-card-desc">
              Every operation produces a newly created PDF file here. Original source files are never overwritten.
            </p>
          </div>
        </div>

        <div className="folder-card-actions">
          <button className="btn-fluent btn-fluent-primary" onClick={handleOpenFolder}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Open Folder
          </button>
          <button className="btn-fluent btn-fluent-secondary" onClick={handleChangeFolder}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
            </svg>
            Change Folder...
          </button>
          <button
            className="btn-fluent btn-fluent-secondary"
            onClick={handleRescan}
            disabled={isScanning}
            title="Scan folder for documents"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={isScanning ? "spin" : ""}
            >
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            {isScanning ? "Scanning..." : "Rescan"}
          </button>
          {records.length > 0 && (
            <button className="btn-fluent btn-fluent-ghost text-danger" onClick={handleClearAll} title="Clear history">
              Clear List
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="history-stats-strip">
        <div className="stat-pill">
          <span className="stat-label">Total Outputs:</span>
          <span className="stat-value">{records.length} files</span>
        </div>
        <div className="stat-pill">
          <span className="stat-label">Storage Managed:</span>
          <span className="stat-value">{formatBytes(totalBytes)}</span>
        </div>
        <div className="stat-pill">
          <span className="stat-label">Non-destructive Mode:</span>
          <span className="stat-value-active">Active</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="history-controls-bar">
        <div className="history-filter-pills">
          {[
            { id: "all", label: "All Outputs" },
            { id: "merge", label: "Merged" },
            { id: "split", label: "Split" },
            { id: "rotate", label: "Rotated" },
            { id: "compress", label: "Compressed" },
            { id: "img2pdf", label: "From Images" },
            { id: "sanitize", label: "Sanitized" },
          ].map((item) => (
            <button
              key={item.id}
              className={`filter-pill ${filterAction === item.id ? "active" : ""}`}
              onClick={() => setFilterAction(item.id)}
            >
              {item.label}
              {item.id === "all" ? ` (${records.length})` : ""}
            </button>
          ))}
        </div>

        <div className="history-search-box">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search outputs or original files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="search-clear-btn" onClick={() => setSearchQuery("")}>
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Processed Files Feed */}
      {filteredRecords.length === 0 ? (
        <div className="history-empty-state">
          <div className="empty-icon-wrap">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <h3>{searchQuery || filterAction !== "all" ? "No Matching Documents" : "No Processed Files Yet"}</h3>
          <p>
            {searchQuery || filterAction !== "all"
              ? "Try adjusting your search query or switching the category filter."
              : "Whenever you merge, split, rotate, compress, or convert documents, each new PDF will be safely organized here."}
          </p>
          {!searchQuery && filterAction === "all" && (
            <div className="empty-actions">
              <button
                className="btn-fluent btn-fluent-primary"
                onClick={() => onNavigateToTool("merge")}
              >
                Merge Documents Now
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="history-items-grid">
          {filteredRecords.map((item) => (
            <div key={item.id} className="history-item-card">
              <div className="history-card-main">
                <div className="history-card-header-row">
                  <div className="history-file-title-wrap">
                    <span className={`action-badge ${getActionBadgeClass(item.action)}`}>
                      {item.actionLabel.toUpperCase()}
                    </span>
                    <h4 className="history-filename" title={item.outputPath}>
                      {item.filename}
                    </h4>
                  </div>
                  <span className="history-time-stamp">{formatDate(item.timestamp)}</span>
                </div>

                <div className="history-path-row">
                  <span className="history-path-text">{item.outputPath}</span>
                </div>

                {item.sourceFiles && item.sourceFiles.length > 0 && (
                  <div className="history-sources-row">
                    <span className="sources-label">Worked on:</span>
                    <div className="sources-chips">
                      {item.sourceFiles.map((src, idx) => {
                        const name = src.split(/[/\\]/).pop() || src;
                        return (
                          <span key={idx} className="source-chip" title={src}>
                            {name}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="history-meta-row">
                  <span className="meta-tag">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="2" width="20" height="20" rx="2" />
                      <path d="M7 2v20" />
                    </svg>
                    {item.pageCount ? `${item.pageCount} pages` : "PDF Document"}
                  </span>
                  <span className="meta-tag">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    </svg>
                    {formatBytes(item.fileSize)}
                  </span>
                </div>
              </div>

              <div className="history-card-actions-bar">
                <div className="primary-actions-group">
                  <button
                    className="btn-card-action primary"
                    onClick={() => handleOpenFile(item)}
                    title="Open in default PDF reader"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    Open PDF
                  </button>
                  <button
                    className="btn-card-action"
                    onClick={() => handleRevealInFolder(item)}
                    title="Reveal in File Explorer"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                    Show in Folder
                  </button>
                  <button
                    className="btn-card-action"
                    onClick={() => handleCopyPath(item)}
                    title="Copy full path to clipboard"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    {copiedId === item.id ? "Copied!" : "Copy Path"}
                  </button>
                </div>

                <div className="secondary-actions-group">
                  <div className="quick-tool-menu">
                    <button
                      className="btn-card-quick"
                      onClick={() => onNavigateToTool("compress", item.outputPath)}
                      title="Send this document to Compress"
                    >
                      Compress
                    </button>
                    <button
                      className="btn-card-quick"
                      onClick={() => onNavigateToTool("split", item.outputPath)}
                      title="Send this document to Split"
                    >
                      Split
                    </button>
                    <button
                      className="btn-card-quick"
                      onClick={() => onNavigateToTool("rotate", item.outputPath)}
                      title="Send this document to Rotate"
                    >
                      Rotate
                    </button>
                  </div>
                  <button
                    className="btn-card-delete"
                    onClick={() => handleDeleteRecord(item)}
                    title="Delete output file"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
