import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

type ToolType = "merge" | "split" | "rotate" | "info";

export default function App() {
  const [activeTool, setActiveTool] = useState<ToolType>("merge");

  // Merge state
  const [mergeInputs, setMergeInputs] = useState<string[]>([]);
  const [newMergePath, setNewMergePath] = useState("");
  const [mergeOutput, setMergeOutput] = useState("");

  // Split state
  const [splitInput, setSplitInput] = useState("");
  const [splitRanges, setSplitRanges] = useState("1-3");
  const [splitOutput, setSplitOutput] = useState("");

  // Rotate state
  const [rotateInput, setRotateInput] = useState("");
  const [rotatePage, setRotatePage] = useState(1);
  const [rotateDelta, setRotateDelta] = useState(90);
  const [rotateOutput, setRotateOutput] = useState("");

  // Info state
  const [infoInput, setInfoInput] = useState("");
  const [infoPages, setInfoPages] = useState<number | null>(null);

  // Status & Feedback
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAddMergeFile = () => {
    if (newMergePath.trim()) {
      setMergeInputs([...mergeInputs, newMergePath.trim()]);
      setNewMergePath("");
    }
  };

  const handleRemoveMergeFile = (index: number) => {
    setMergeInputs(mergeInputs.filter((_, i) => i !== index));
  };

  const executeMerge = async () => {
    if (mergeInputs.length < 2 || !mergeOutput.trim()) {
      setStatusMessage("Please specify at least 2 input files and an output file path.");
      setIsError(true);
      return;
    }
    setIsProcessing(true);
    setStatusMessage(null);
    try {
      const pageCount = await invoke<number>("pdf_merge", {
        inputs: mergeInputs,
        output: mergeOutput.trim(),
      });
      setStatusMessage(`Success! Merged ${pageCount} pages into: ${mergeOutput}`);
      setIsError(false);
    } catch (err: any) {
      setStatusMessage(`Error merging files: ${err}`);
      setIsError(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const executeSplit = async () => {
    if (!splitInput.trim() || !splitRanges.trim() || !splitOutput.trim()) {
      setStatusMessage("Please specify input file, page ranges, and output path.");
      setIsError(true);
      return;
    }
    setIsProcessing(true);
    setStatusMessage(null);
    try {
      const pageCount = await invoke<number>("pdf_split", {
        input: splitInput.trim(),
        ranges: splitRanges.trim(),
        output: splitOutput.trim(),
      });
      setStatusMessage(`Success! Saved ${pageCount} extracted pages to: ${splitOutput}`);
      setIsError(false);
    } catch (err: any) {
      setStatusMessage(`Error splitting file: ${err}`);
      setIsError(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const executeRotate = async () => {
    if (!rotateInput.trim() || !rotateOutput.trim()) {
      setStatusMessage("Please specify input file and output path.");
      setIsError(true);
      return;
    }
    setIsProcessing(true);
    setStatusMessage(null);
    try {
      await invoke("pdf_rotate", {
        input: rotateInput.trim(),
        page: Number(rotatePage),
        delta: Number(rotateDelta),
        output: rotateOutput.trim(),
      });
      setStatusMessage(`Success! Rotated page ${rotatePage} by ${rotateDelta}° and saved to: ${rotateOutput}`);
      setIsError(false);
    } catch (err: any) {
      setStatusMessage(`Error rotating page: ${err}`);
      setIsError(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const executeInfo = async () => {
    if (!infoInput.trim()) {
      setStatusMessage("Please enter a PDF file path.");
      setIsError(true);
      return;
    }
    setIsProcessing(true);
    setStatusMessage(null);
    try {
      const pages = await invoke<number>("pdf_info", { path: infoInput.trim() });
      setInfoPages(pages);
      setStatusMessage(`Document valid: ${pages} total pages detected.`);
      setIsError(false);
    } catch (err: any) {
      setStatusMessage(`Error inspecting document: ${err}`);
      setIsError(true);
      setInfoPages(null);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="app-layout">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="brand">
          <img src="/logo.jpg" alt="PaperFlow Logo" className="brand-logo-img" />
          <div>
            <div className="brand-title">PaperFlow</div>
            <div className="brand-subtitle">RUST CORE • 100% OFFLINE</div>
          </div>
        </div>

        <nav className="nav-menu">
          <button
            className={`nav-btn ${activeTool === "merge" ? "active" : ""}`}
            onClick={() => { setActiveTool("merge"); setStatusMessage(null); }}
          >
            <span>⚯</span> Merge PDFs
          </button>
          <button
            className={`nav-btn ${activeTool === "split" ? "active" : ""}`}
            onClick={() => { setActiveTool("split"); setStatusMessage(null); }}
          >
            <span>✂</span> Split PDF
          </button>
          <button
            className={`nav-btn ${activeTool === "rotate" ? "active" : ""}`}
            onClick={() => { setActiveTool("rotate"); setStatusMessage(null); }}
          >
            <span>↻</span> Rotate Pages
          </button>
          <button
            className={`nav-btn ${activeTool === "info" ? "active" : ""}`}
            onClick={() => { setActiveTool("info"); setStatusMessage(null); }}
          >
            <span>ℹ</span> Document Info
          </button>
        </nav>

        <div className="sidebar-footer">
          <div>Target: Fedora Linux & Android</div>
          <div style={{ marginTop: "4px", color: "#10ac84" }}>● Sandbox Network Disabled</div>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="main-content">
        <div className="hero-banner">
          <div className="privacy-badge">🔒 ZERO REMOTE UPLOADS • VERIFIABLE PRIVACY</div>
          <h1 className="hero-title">High-Performance Native PDF Studio</h1>
          <p className="hero-desc">
            Powered by <code>paperflow-core</code> pure-Rust manipulation engine. Non-destructive, fast, and completely private on Fedora Linux and Android.
          </p>
        </div>

        {/* Merge Tool */}
        {activeTool === "merge" && (
          <div className="tool-pane">
            <div className="tool-header">
              <h2 className="tool-title">Merge Multiple PDFs</h2>
              <p className="tool-desc">Combine PDF documents in any sequential order with object deduplication.</p>
            </div>

            <div className="form-group">
              <label className="form-label">Add PDF file path:</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  className="text-input"
                  placeholder="/home/user/Documents/report.pdf"
                  value={newMergePath}
                  onChange={(e) => setNewMergePath(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddMergeFile()}
                />
                <button className="action-btn" style={{ padding: "10px 20px" }} onClick={handleAddMergeFile}>
                  Add
                </button>
              </div>
            </div>

            {mergeInputs.length > 0 && (
              <div className="file-list">
                {mergeInputs.map((path, idx) => (
                  <div key={idx} className="file-item">
                    <span><strong>{idx + 1}.</strong> {path}</span>
                    <button className="file-remove-btn" onClick={() => handleRemoveMergeFile(idx)}>Remove</button>
                  </div>
                ))}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Output file destination:</label>
              <input
                type="text"
                className="text-input"
                placeholder="/home/user/Documents/merged_output.pdf"
                value={mergeOutput}
                onChange={(e) => setMergeOutput(e.target.value)}
              />
            </div>

            <button
              className="action-btn"
              disabled={isProcessing || mergeInputs.length < 2 || !mergeOutput.trim()}
              onClick={executeMerge}
            >
              {isProcessing ? "Merging in Rust Core..." : `Merge ${mergeInputs.length} PDFs`}
            </button>
          </div>
        )}

        {/* Split Tool */}
        {activeTool === "split" && (
          <div className="tool-pane">
            <div className="tool-header">
              <h2 className="tool-title">Split Document by Pages</h2>
              <p className="tool-desc">Extract specific page sequences or intervals non-destructively.</p>
            </div>

            <div className="form-group">
              <label className="form-label">Source PDF file path:</label>
              <input
                type="text"
                className="text-input"
                placeholder="/home/user/Documents/source.pdf"
                value={splitInput}
                onChange={(e) => setSplitInput(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Page Ranges to Extract (e.g. 1-3, 5, 8-10):</label>
              <input
                type="text"
                className="text-input"
                placeholder="1-3, 5"
                value={splitRanges}
                onChange={(e) => setSplitRanges(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Output destination path:</label>
              <input
                type="text"
                className="text-input"
                placeholder="/home/user/Documents/extracted_pages.pdf"
                value={splitOutput}
                onChange={(e) => setSplitOutput(e.target.value)}
              />
            </div>

            <button
              className="action-btn"
              disabled={isProcessing || !splitInput.trim() || !splitOutput.trim()}
              onClick={executeSplit}
            >
              {isProcessing ? "Extracting Pages..." : "Split & Save PDF"}
            </button>
          </div>
        )}

        {/* Rotate Tool */}
        {activeTool === "rotate" && (
          <div className="tool-pane">
            <div className="tool-header">
              <h2 className="tool-title">Rotate Document Pages</h2>
              <p className="tool-desc">Adjust orientation of specific pages by 90°, 180°, or 270°.</p>
            </div>

            <div className="form-group">
              <label className="form-label">Source PDF file path:</label>
              <input
                type="text"
                className="text-input"
                placeholder="/home/user/Documents/document.pdf"
                value={rotateInput}
                onChange={(e) => setRotateInput(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", gap: "16px", marginBottom: "20px" }}>
              <div style={{ flex: 1 }}>
                <label className="form-label">Page Number (1-based):</label>
                <input
                  type="number"
                  min="1"
                  className="text-input"
                  value={rotatePage}
                  onChange={(e) => setRotatePage(Number(e.target.value))}
                />
              </div>

              <div style={{ flex: 1 }}>
                <label className="form-label">Rotation Angle:</label>
                <select
                  className="text-input"
                  value={rotateDelta}
                  onChange={(e) => setRotateDelta(Number(e.target.value))}
                >
                  <option value={90}>90° Clockwise</option>
                  <option value={180}>180° Flip</option>
                  <option value={270}>270° Counter-Clockwise</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Output destination path:</label>
              <input
                type="text"
                className="text-input"
                placeholder="/home/user/Documents/rotated_output.pdf"
                value={rotateOutput}
                onChange={(e) => setRotateOutput(e.target.value)}
              />
            </div>

            <button
              className="action-btn"
              disabled={isProcessing || !rotateInput.trim() || !rotateOutput.trim()}
              onClick={executeRotate}
            >
              {isProcessing ? "Applying Rotation..." : "Rotate & Save"}
            </button>
          </div>
        )}

        {/* Info Tool */}
        {activeTool === "info" && (
          <div className="tool-pane">
            <div className="tool-header">
              <h2 className="tool-title">Inspect PDF Metadata & Pages</h2>
              <p className="tool-desc">Verify structural integrity and retrieve page counts.</p>
            </div>

            <div className="form-group">
              <label className="form-label">Target PDF file path:</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  className="text-input"
                  placeholder="/home/user/Documents/sample.pdf"
                  value={infoInput}
                  onChange={(e) => setInfoInput(e.target.value)}
                />
                <button className="action-btn" style={{ padding: "10px 24px" }} onClick={executeInfo}>
                  Inspect
                </button>
              </div>
            </div>

            {infoPages !== null && (
              <div style={{ marginTop: "16px", padding: "16px", background: "rgba(255,255,255,0.04)", borderRadius: "10px" }}>
                <div style={{ fontSize: "14px", color: "#a4b0be" }}>Total Pages:</div>
                <div style={{ fontSize: "28px", fontWeight: "bold", color: "#00d2d3" }}>{infoPages} Pages</div>
              </div>
            )}
          </div>
        )}

        {/* Feedback message banner */}
        {statusMessage && (
          <div className={`feedback-card ${isError ? "feedback-error" : "feedback-success"}`}>
            {statusMessage}
          </div>
        )}
      </main>
    </div>
  );
}
