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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [isEditingFolder, setIsEditingFolder] = useState(false);
  const [customFolderInput, setCustomFolderInput] = useState(outputDir);

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
      onShowToast("Storage folder rescanned", "info");
    } catch (e) {
      console.error(e);
      onShowToast("Rescan failed", "warning");
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
        console.warn("Failed to open folder:", err);
        onShowToast("Could not open folder", "warning");
      }
    } else {
      onShowToast(`Dedicated folder: ${outputDir}`, "info");
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
          onShowToast("Output storage folder updated", "success");
          return;
        }
      } catch (err) {
        console.warn("Folder picker error:", err);
      }
    }

    setCustomFolderInput(outputDir);
    setIsEditingFolder(true);
  };

  const saveCustomFolder = () => {
    if (customFolderInput && customFolderInput.trim()) {
      const trimmed = customFolderInput.trim();
      onOutputDirChange(trimmed);
      setPreferredOutputDir(trimmed);
      onShowToast("Output storage folder updated", "success");
    }
    setIsEditingFolder(false);
  };

  const handleOpenFile = async (record: ProcessedFileRecord) => {
    if (isTauriEnvironment()) {
      try {
        await invoke("open_file", { path: record.outputPath });
      } catch (err) {
        console.warn("Could not open file:", err);
        onShowToast("Could not open document", "warning");
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
        console.warn("Could not open folder:", err);
        onShowToast("Could not reveal file", "warning");
      }
    } else {
      onShowToast(`File location: ${record.outputPath}`, "info");
    }
  };

  const handleCopyPath = async (record: ProcessedFileRecord) => {
    try {
      await navigator.clipboard.writeText(record.outputPath);
      setCopiedId(record.id);
      setTimeout(() => setCopiedId(null), 2000);
      onShowToast("Path copied to clipboard", "success");
    } catch {
      onShowToast("Failed to copy path", "warning");
    }
  };

  const executeDelete = async (record: ProcessedFileRecord) => {
    if (isTauriEnvironment()) {
      try {
        await invoke("delete_file", { path: record.outputPath });
      } catch (err) {
        console.warn("Could not delete from disk:", err);
      }
    }
    removeHistoryRecord(record.id);
    setConfirmDeleteId(null);
    onShowToast("Record removed", "info");
  };

  const executeClear = () => {
    clearHistory();
    setIsConfirmingClear(false);
    onShowToast("Work history cleared", "info");
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

  const getActionIcon = (action: string) => {
    switch (action) {
      case "merge":
        return (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 6h12" />
            <path d="M8 12h12" />
            <path d="M8 18h12" />
            <circle cx="4" cy="6" r="1.5" fill="currentColor" />
            <circle cx="4" cy="12" r="1.5" fill="currentColor" />
            <circle cx="4" cy="18" r="1.5" fill="currentColor" />
          </svg>
        );
      case "split":
        return (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="6" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <line x1="20" y1="4" x2="8.12" y2="15.88" />
            <line x1="14.47" y1="14.48" x2="20" y2="20" />
            <line x1="8.12" y1="8.12" x2="12" y2="12" />
          </svg>
        );
      case "rotate":
        return (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.5 2v6h-6" />
            <path d="M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
          </svg>
        );
      case "compress":
        return (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="4 14 10 14 10 20" />
            <polyline points="20 10 14 10 14 4" />
            <line x1="14" y1="10" x2="21" y2="3" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
        );
      case "img2pdf":
        return (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        );
      case "sanitize":
        return (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        );
      default:
        return (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        );
    }
  };

  const totalBytes = records.reduce((acc, r) => acc + (r.fileSize || 0), 0);

  const filterTabs = [
    { id: "all", label: "All" },
    { id: "merge", label: "Merged" },
    { id: "split", label: "Split" },
    { id: "rotate", label: "Rotated" },
    { id: "compress", label: "Compressed" },
    { id: "img2pdf", label: "Images" },
    { id: "sanitize", label: "Sanitized" },
  ];

  return (
    <div className="history-tab-container">
      {/* Sleek Storage & Stats Bar */}
      <div className="history-storage-bar">
        <div className="storage-bar-left">
          <div className="storage-icon-wrap" title="Dedicated Output Storage Folder">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          </div>

          <div className="storage-details">
            <span className="storage-title">Dedicated Storage:</span>
            {isEditingFolder ? (
              <div className="inline-folder-edit-box">
                <input
                  type="text"
                  value={customFolderInput}
                  onChange={(e) => setCustomFolderInput(e.target.value)}
                  className="inline-folder-input"
                  placeholder="Enter directory path..."
                  autoFocus
                />
                <button className="btn-fluent-mini primary" onClick={saveCustomFolder}>
                  Save
                </button>
                <button
                  className="btn-fluent-mini"
                  onClick={() => setIsEditingFolder(false)}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <span className="storage-path-display" title={outputDir}>
                {outputDir || "Resolving dedicated folder..."}
              </span>
            )}
          </div>

          <div className="storage-btn-group">
            <button
              className="btn-storage-action"
              onClick={handleOpenFolder}
              title="Open dedicated folder in file manager"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              <span>Open</span>
            </button>
            <button
              className="btn-storage-action"
              onClick={handleChangeFolder}
              title="Change output directory"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
              </svg>
              <span>Change</span>
            </button>
            <button
              className="btn-storage-action icon-only"
              onClick={handleRescan}
              disabled={isScanning}
              title="Rescan directory"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={isScanning ? "spin" : ""}
              >
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
          </div>
        </div>

        <div className="storage-bar-right">
          <div className="storage-stats-info">
            <span className="stats-count">
              <strong>{records.length}</strong> {records.length === 1 ? "document" : "documents"}
            </span>
            {records.length > 0 && (
              <>
                <span className="stats-bullet">•</span>
                <span className="stats-size">{formatBytes(totalBytes)}</span>
              </>
            )}
          </div>

          {records.length > 0 &&
            (isConfirmingClear ? (
              <div className="inline-header-confirm">
                <span>Clear history?</span>
                <button className="btn-confirm-delete" onClick={executeClear}>
                  Yes
                </button>
                <button
                  className="btn-confirm-cancel"
                  onClick={() => setIsConfirmingClear(false)}
                >
                  No
                </button>
              </div>
            ) : (
              <button
                className="btn-clear-history"
                onClick={() => setIsConfirmingClear(true)}
                title="Clear history list (preserves files on disk)"
              >
                Clear History
              </button>
            ))}
        </div>
      </div>

      {/* Filter Tabs & Search Controls */}
      <div className="history-filter-bar">
        <div className="history-filter-pills">
          {filterTabs.map((item) => {
            const count =
              item.id === "all"
                ? records.length
                : records.filter((r) => r.action === item.id).length;
            return (
              <button
                key={item.id}
                className={`filter-pill ${filterAction === item.id ? "active" : ""}`}
                onClick={() => setFilterAction(item.id)}
              >
                <span>{item.label}</span>
                <span className="filter-pill-count">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="history-search-box">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search documents or sources..."
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

      {/* Documents Feed */}
      {filteredRecords.length === 0 ? (
        <div className="history-empty-state">
          <div className="empty-icon-wrap">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <h3>{searchQuery || filterAction !== "all" ? "No Matching Documents" : "No Processed Files Yet"}</h3>
          <p>
            {searchQuery || filterAction !== "all"
              ? "No files matched your search or category filter. Try clearing the search."
              : "Every time you merge, split, rotate, or compress PDFs, newly generated documents will be safely organized here."}
          </p>
          {!searchQuery && filterAction === "all" && (
            <button
              className="btn-empty-start"
              onClick={() => onNavigateToTool("merge")}
            >
              Start by Merging PDFs
            </button>
          )}
        </div>
      ) : (
        <div className="history-items-list">
          {filteredRecords.map((item) => (
            <div key={item.id} className="history-item-row">
              {/* Left Action Icon */}
              <div
                className={`history-item-icon-box ${getActionBadgeClass(item.action)}`}
                title={item.actionLabel}
              >
                {getActionIcon(item.action)}
              </div>

              {/* Main Info */}
              <div className="history-item-content">
                <div className="history-item-title-row">
                  <h4 className="history-item-filename" title={item.outputPath}>
                    {item.filename}
                  </h4>
                  <span className={`action-tag-pill ${getActionBadgeClass(item.action)}`}>
                    {item.actionLabel}
                  </span>
                  <span className="history-item-time">{formatDate(item.timestamp)}</span>
                </div>

                <div className="history-item-meta-row">
                  <span className="meta-stat">
                    {item.pageCount ? `${item.pageCount} pages` : "PDF document"}
                  </span>
                  <span className="meta-sep">•</span>
                  <span className="meta-stat">{formatBytes(item.fileSize)}</span>

                  {item.sourceFiles && item.sourceFiles.length > 0 && (
                    <>
                      <span className="meta-sep">•</span>
                      <span className="meta-sources-wrap">
                        <span className="sources-prefix">From:</span>
                        {item.sourceFiles.map((src, idx) => {
                          const name = src.split(/[/\\]/).pop() || src;
                          return (
                            <span key={idx} className="source-pill" title={src}>
                              {name}
                            </span>
                          );
                        })}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="history-item-actions">
                <button
                  className="btn-item-action primary"
                  onClick={() => handleOpenFile(item)}
                  title="Open PDF in default viewer"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  <span>Open</span>
                </button>

                <button
                  className="btn-item-action"
                  onClick={() => handleRevealInFolder(item)}
                  title="Show file in folder"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                </button>

                <button
                  className="btn-item-action"
                  onClick={() => handleCopyPath(item)}
                  title="Copy full file path"
                >
                  {copiedId === item.id ? (
                    <span className="copied-check">✓</span>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>

                <div className="item-actions-sep" />

                <div className="item-tools-group">
                  <button
                    className="btn-tool-shortcut"
                    onClick={() => onNavigateToTool("compress", item.outputPath)}
                    title="Send to Compress"
                  >
                    Compress
                  </button>
                  <button
                    className="btn-tool-shortcut"
                    onClick={() => onNavigateToTool("split", item.outputPath)}
                    title="Send to Split"
                  >
                    Split
                  </button>
                  <button
                    className="btn-tool-shortcut"
                    onClick={() => onNavigateToTool("rotate", item.outputPath)}
                    title="Send to Rotate"
                  >
                    Rotate
                  </button>
                </div>

                <div className="item-actions-sep" />

                {confirmDeleteId === item.id ? (
                  <div className="inline-card-confirm">
                    <span>Delete?</span>
                    <button className="btn-confirm-delete" onClick={() => executeDelete(item)}>
                      Yes
                    </button>
                    <button
                      className="btn-confirm-cancel"
                      onClick={() => setConfirmDeleteId(null)}
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn-item-delete"
                    onClick={() => setConfirmDeleteId(item.id)}
                    title="Delete document"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
