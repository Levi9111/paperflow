import React, { useEffect, useState } from "react";

export interface ToastMessage {
  id: string;
  text: string;
  type?: "info" | "success" | "warning";
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: () => void }> = ({
  toast,
  onDismiss,
}) => {
  const [isDismissing, setIsDismissing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      triggerDismiss();
    }, 3200);
    return () => clearTimeout(timer);
  }, []);

  const triggerDismiss = () => {
    setIsDismissing(true);
    setTimeout(() => {
      onDismiss();
    }, 180);
  };

  const renderIcon = () => {
    if (toast.type === "success") {
      return (
        <svg className="toast-icon success" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    }
    if (toast.type === "warning") {
      return (
        <svg className="toast-icon warning" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    }
    return (
      <svg className="toast-icon info" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    );
  };

  return (
    <div
      className={`toast-item ${toast.type || "info"} ${isDismissing ? "dismissing" : ""}`}
      onClick={triggerDismiss}
      role="alert"
    >
      <div className="toast-icon-wrapper">{renderIcon()}</div>
      <span className="toast-text">{toast.text}</span>
      <button
        type="button"
        className="toast-close"
        onClick={(e) => {
          e.stopPropagation();
          triggerDismiss();
        }}
        aria-label="Dismiss notification"
      >
        ✕
      </button>
    </div>
  );
};
