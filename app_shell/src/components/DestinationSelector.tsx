import React from "react";
import { save } from "@tauri-apps/plugin-dialog";

interface DestinationSelectorProps {
  outputPath: string;
  defaultFilename: string;
  onChange: (newPath: string) => void;
  label?: string;
}

export const DestinationSelector: React.FC<DestinationSelectorProps> = ({
  outputPath,
  defaultFilename,
  onChange,
  label = "Output Destination",
}) => {
  const handleBrowseDestination = async () => {
    try {
      const selected = await save({
        defaultPath: outputPath || defaultFilename,
        filters: [{ name: "PDF Document", extensions: ["pdf"] }],
      });
      if (selected) {
        onChange(selected);
      }
    } catch (err) {
      console.error("Save dialog error:", err);
    }
  };

  return (
    <div className="destination-selector-container">
      <div className="destination-header">
        <label className="destination-label">{label}</label>
        <button
          type="button"
          className="btn-destination-change"
          onClick={handleBrowseDestination}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
          </svg>
          Choose Save Location...
        </button>
      </div>
      <div className="destination-input-box" onClick={handleBrowseDestination}>
        <div className="destination-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
        </div>
        <span className="destination-path-text" title={outputPath}>
          {outputPath || "No location chosen yet (click to select save path)"}
        </span>
      </div>
    </div>
  );
};
