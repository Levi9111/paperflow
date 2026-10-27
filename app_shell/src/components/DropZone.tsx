import React, { useState, useRef } from "react";
import { pickFiles } from "../utils/filePicker";
import { registerBrowserFile } from "../utils/docCache";
import { isTauriEnvironment } from "../utils/platform";

interface DropZoneProps {
  onFilesSelected: (paths: string[]) => void;
  multiple?: boolean;
  acceptLabel?: string;
  extensions?: string[];
  title?: string;
  subtitle?: string;
  compact?: boolean;
}

export const DropZone: React.FC<DropZoneProps> = ({
  onFilesSelected,
  multiple = false,
  acceptLabel = "PDF files",
  extensions = ["pdf"],
  title = "Drag & drop files here",
  subtitle = "or click to browse from your device",
  compact = false,
}) => {
  const [isOver, setIsOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleBrowse = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isTauriEnvironment()) {
      try {
        const paths = await pickFiles({ multiple, acceptLabel, extensions });
        if (paths && paths.length > 0) {
          onFilesSelected(paths);
          return;
        }
      } catch (err) {
        console.warn("Tauri picker failed, falling back to browser input:", err);
      }
    }

    // Direct browser input fallback
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const paths = files.map((f) => registerBrowserFile(f));
    onFilesSelected(paths);
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOver(false);

    const droppedFiles = Array.from(e.dataTransfer.files || []);
    if (droppedFiles.length === 0) return;

    const paths = droppedFiles.map((f) => registerBrowserFile(f));
    if (paths.length > 0) {
      if (!multiple) {
        onFilesSelected([paths[0]]);
      } else {
        onFilesSelected(paths);
      }
    }
  };

  return (
    <div
      className={`dropzone-container ${isOver ? "drag-over" : ""} ${compact ? "compact" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleBrowse}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          handleBrowse(e as any);
        }
      }}
    >
      {/* Hidden browser input element */}
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: "none" }}
        multiple={multiple}
        accept={extensions.map((ext) => `.${ext.replace(/^\./, "")}`).join(",")}
        onChange={handleFileInputChange}
      />

      <div className="dropzone-glow" />
      <div className="dropzone-content">
        <div className="dropzone-icon-wrapper">
          <svg
            className="dropzone-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
            <path d="M12 12v9" />
            <path d="m8 16 4-4 4 4" />
          </svg>
        </div>
        <div className="dropzone-text-group">
          <h3 className="dropzone-title">{title}</h3>
          <p className="dropzone-subtitle">{subtitle}</p>
        </div>
        <button
          type="button"
          className="btn-browse"
          onClick={handleBrowse}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
          </svg>
          Browse Files
        </button>
        <span className="dropzone-badge">
          Supports {extensions.map((ext) => `.${ext.replace(/^\./, "")}`).join(", ")}
        </span>
      </div>
    </div>
  );
};
