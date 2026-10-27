import React from "react";
import { DocDetails } from "../types/pdf";
import { formatBytes } from "../utils/format";

interface DocumentQueueProps {
  documents: DocDetails[];
  onRemove: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onAddMore: () => void;
  onClear: () => void;
}

export const DocumentQueue: React.FC<DocumentQueueProps> = ({
  documents,
  onRemove,
  onMoveUp,
  onMoveDown,
  onAddMore,
  onClear,
}) => {
  const totalPages = documents.reduce((acc, doc) => acc + (doc.page_count || 0), 0);
  const totalBytes = documents.reduce((acc, doc) => acc + (doc.file_size || 0), 0);

  return (
    <div className="doc-queue-container">
      <div className="queue-header">
        <div className="queue-header-left">
          <span className="queue-title">Merge Queue ({documents.length})</span>
          <span className="queue-summary">
            {totalPages} total pages • {formatBytes(totalBytes)}
          </span>
        </div>
        <div className="queue-header-actions">
          <button type="button" className="btn-queue-add" onClick={onAddMore}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add More
          </button>
          <button type="button" className="btn-queue-clear" onClick={onClear}>
            Clear
          </button>
        </div>
      </div>

      <div className="queue-list">
        {documents.map((doc, index) => (
          <div key={`${doc.path}-${index}`} className="queue-item">
            <div className="queue-item-index">{String(index + 1).padStart(2, "0")}</div>
            <div className="queue-item-info">
              <div className="queue-item-title" title={doc.path}>
                {doc.filename}
              </div>
              <div className="queue-item-meta">
                <span>{doc.page_count} pages</span>
                <span>•</span>
                <span>{formatBytes(doc.file_size)}</span>
              </div>
            </div>
            <div className="queue-item-controls">
              <button
                type="button"
                className="btn-order"
                disabled={index === 0}
                onClick={() => onMoveUp(index)}
                title="Move up"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="m18 15-6-6-6 6" />
                </svg>
              </button>
              <button
                type="button"
                className="btn-order"
                disabled={index === documents.length - 1}
                onClick={() => onMoveDown(index)}
                title="Move down"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                className="btn-remove-item"
                onClick={() => onRemove(index)}
                title="Remove from queue"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
