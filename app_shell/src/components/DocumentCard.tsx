import React from "react";
import { DocDetails } from "../types/pdf";
import { formatBytes } from "../utils/format";

interface DocumentCardProps {
  doc: DocDetails;
  onRemove: () => void;
  onChangeFile?: () => void;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({
  doc,
  onRemove,
  onChangeFile,
}) => {
  return (
    <div className="doc-card-container">
      <div className="doc-card-left">
        <div className="doc-icon-badge">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
            <path d="M14 2v4a2 2 0 0 0 2 2h4" />
            <path d="M10 9H8" />
            <path d="M16 13H8" />
            <path d="M16 17H8" />
          </svg>
          <span className="doc-ext">PDF</span>
        </div>
        <div className="doc-details">
          <div className="doc-name" title={doc.path}>
            {doc.filename}
          </div>
          <div className="doc-meta-row">
            <span className="doc-meta-pill page-pill">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M3 9h18" />
              </svg>
              {doc.page_count} {doc.page_count === 1 ? "Page" : "Pages"}
            </span>
            <span className="doc-meta-pill size-pill">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
              {formatBytes(doc.file_size)}
            </span>
            {doc.title && (
              <span className="doc-meta-pill title-pill" title={doc.title}>
                {doc.title}
              </span>
            )}
          </div>
          <div className="doc-path-sub" title={doc.path}>
            {doc.path}
          </div>
        </div>
      </div>
      <div className="doc-card-actions">
        {onChangeFile && (
          <button
            type="button"
            className="btn-action-ghost"
            onClick={onChangeFile}
            title="Change selected file"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            Replace
          </button>
        )}
        <button
          type="button"
          className="btn-action-danger"
          onClick={onRemove}
          title="Remove document"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
};
