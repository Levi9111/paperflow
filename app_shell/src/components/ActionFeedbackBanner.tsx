import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { isTauriEnvironment } from "../utils/platform";

export interface ActionFeedbackData {
  type: "success" | "error" | "warning";
  title: string;
  message: string;
  outputPath?: string;
  fileSize?: number;
  pageCount?: number;
}

interface ActionFeedbackBannerProps {
  feedback: ActionFeedbackData | null;
  onDismiss: () => void;
  onViewHistory?: () => void;
}

export const ActionFeedbackBanner: React.FC<ActionFeedbackBannerProps> = ({
  feedback,
  onDismiss,
  onViewHistory,
}) => {
  const [copied, setCopied] = useState(false);

  if (!feedback) return null;

  const handleOpenPdf = async () => {
    if (!feedback.outputPath) return;
    if (isTauriEnvironment()) {
      try {
        await invoke("open_file", { path: feedback.outputPath });
        return;
      } catch (err) {
        console.error("Open file error:", err);
      }
    } else {
      window.open(feedback.outputPath, "_blank");
    }
  };

  const handleReveal = async () => {
    if (!feedback.outputPath) return;
    if (isTauriEnvironment()) {
      try {
        await invoke("open_folder", { path: feedback.outputPath });
        return;
      } catch (err) {
        console.error("Reveal folder error:", err);
      }
    }
  };

  const handleCopyPath = async () => {
    if (!feedback.outputPath) return;
    try {
      await navigator.clipboard.writeText(feedback.outputPath);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn("Clipboard copy failed", e);
    }
  };

  const isSuccess = feedback.type === "success";

  return (
    <div className={`action-feedback-banner ${feedback.type}`} role="status">
      <div className="feedback-content-left">
        <div className="feedback-icon-box">
          {isSuccess ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          ) : feedback.type === "warning" ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          )}
        </div>

        <div className="feedback-text-stack">
          <div className="feedback-title-row">
            <span className="feedback-title">{feedback.title}</span>
            {feedback.outputPath && (
              <span className="feedback-path-pill" title={feedback.outputPath} onClick={handleCopyPath}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                {feedback.outputPath.split(/[/\\]/).pop()}
                <span className="feedback-copy-hint">{copied ? "Copied!" : "Copy"}</span>
              </span>
            )}
          </div>
          <p className="feedback-message">{feedback.message}</p>
        </div>
      </div>

      <div className="feedback-actions-right">
        {feedback.outputPath && isSuccess && (
          <>
            <button
              type="button"
              className="btn-feedback-action primary"
              onClick={handleOpenPdf}
              title="Open document in system reader"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Open PDF
            </button>
            <button
              type="button"
              className="btn-feedback-action secondary"
              onClick={handleReveal}
              title="Reveal in folder"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              Folder
            </button>
          </>
        )}

        {onViewHistory && isSuccess && (
          <button
            type="button"
            className="btn-feedback-action ghost"
            onClick={onViewHistory}
            title="Open in Work History tab"
          >
            History
          </button>
        )}

        <button
          type="button"
          className="btn-feedback-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss feedback"
        >
          ✕
        </button>
      </div>
    </div>
  );
};
