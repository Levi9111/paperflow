import React from "react";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import { isTauriEnvironment } from "../utils/platform";

interface ResultModalProps {
  title: string;
  message: string;
  outputPath?: string;
  isError?: boolean;
  onClose: () => void;
}

export const ResultModal: React.FC<ResultModalProps> = ({
  title,
  message,
  outputPath,
  isError = false,
  onClose,
}) => {
  const handleOpenPdf = async () => {
    if (outputPath) {
      if (isTauriEnvironment()) {
        try {
          await openPath(outputPath);
          return;
        } catch (err) {
          console.error("Open path error:", err);
        }
      }
      alert(`Document path: ${outputPath}\n\n(In desktop mode, this automatically launches your system PDF viewer)`);
    }
  };

  const handleReveal = async () => {
    if (outputPath) {
      if (isTauriEnvironment()) {
        try {
          await revealItemInDir(outputPath);
          return;
        } catch (err) {
          console.error("Reveal item error:", err);
        }
      }
      alert(`Output location:\n${outputPath}\n\n(In desktop mode, this opens the folder in your file manager)`);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal-card ${isError ? "error" : "success"}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-icon-badge">
            {isError ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            )}
          </div>
          <div>
            <h3 className="modal-title">{title}</h3>
            <p className="modal-message">{message}</p>
          </div>
        </div>

        {outputPath && !isError && (
          <div className="modal-path-preview">
            <span className="modal-path-label">Saved to:</span>
            <code className="modal-path-code">{outputPath}</code>
          </div>
        )}

        <div className="modal-actions">
          {outputPath && !isError && (
            <>
              <button type="button" className="btn-modal-primary" onClick={handleOpenPdf}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                Open Document
              </button>
              <button type="button" className="btn-modal-secondary" onClick={handleReveal}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
                </svg>
                Show in Folder
              </button>
            </>
          )}
          <button type="button" className="btn-modal-close" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
