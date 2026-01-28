import { useState, useMemo, useCallback } from "react";
import "./App.css";
import { parseRoadmapText, resolveRoadmap, getExampleText } from "./parser";
import { renderToSVG, downloadSVG } from "./renderer";
import { copyDrawioToClipboard, downloadDrawio } from "./drawio";

function App() {
  const [inputText, setInputText] = useState(getExampleText());
  const [copyStatus, setCopyStatus] = useState<string>("");

  const roadmapData = useMemo(() => {
    try {
      const parsed = parseRoadmapText(inputText);
      return resolveRoadmap(parsed);
    } catch (e) {
      console.error("Parse error:", e);
      return null;
    }
  }, [inputText]);

  const svgString = useMemo(() => {
    if (!roadmapData) return "";
    return renderToSVG(roadmapData);
  }, [roadmapData]);

  const handleCopyDrawio = useCallback(async () => {
    if (!roadmapData) return;
    try {
      await copyDrawioToClipboard(roadmapData);
      setCopyStatus("Copied draw.io XML to clipboard!");
      setTimeout(() => setCopyStatus(""), 3000);
    } catch (e) {
      console.error("Clipboard error:", e);
      setCopyStatus(
        `Failed to copy: ${e instanceof Error ? e.message : "Unknown error"}`,
      );
      setTimeout(() => setCopyStatus(""), 3000);
    }
  }, [roadmapData]);

  const handleDownloadSVG = useCallback(() => {
    if (!svgString) return;
    downloadSVG(svgString, "roadmap.svg");
  }, [svgString]);

  const handleDownloadDrawio = useCallback(() => {
    if (!roadmapData) return;
    downloadDrawio(roadmapData, "roadmap.drawio");
  }, [roadmapData]);

  const handleCopySVG = useCallback(async () => {
    if (!svgString) return;
    try {
      await navigator.clipboard.writeText(svgString);
      setCopyStatus("Copied SVG to clipboard!");
      setTimeout(() => setCopyStatus(""), 3000);
    } catch (e) {
      setCopyStatus("Failed to copy SVG");
      setTimeout(() => setCopyStatus(""), 3000);
    }
  }, [svgString]);

  return (
    <div className="app">
      <header className="header">
        <h1>📊 Text to Roadmap</h1>
        <p>Convert text to visual roadmap diagrams</p>
      </header>

      <main className="main">
        <section className="editor-section">
          <div className="section-header">
            <h2>Input</h2>
            <button
              className="btn btn-secondary"
              onClick={() => setInputText(getExampleText())}
            >
              Load Example
            </button>
          </div>
          <textarea
            className="editor"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`# My Roadmap

## Periods
Q1, Q2, Q3, Q4

## Team Name
- Task name | start: Q1 | end: Q2
- Another task | start: Q2 | length: 2`}
            spellCheck={false}
          />
          <div className="help-text">
            <strong>Format:</strong> Use <code># Title</code> for roadmap title,
            <code>## Periods</code> followed by comma-separated periods, then{" "}
            <code>## Team Name</code> sections with items like
            <code>- Task | start: Q1 | end: Q3</code> or
            <code>- Task | start: Q1 | length: 2</code>
          </div>
        </section>

        <section className="preview-section">
          <div className="section-header">
            <h2>Preview</h2>
            <div className="button-group">
              <button
                className="btn btn-primary"
                onClick={handleDownloadSVG}
                disabled={!svgString}
              >
                📥 Download SVG
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCopySVG}
                disabled={!svgString}
              >
                📋 Copy SVG
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleCopyDrawio}
                disabled={!roadmapData}
              >
                📋 Copy draw.io XML
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleDownloadDrawio}
                disabled={!roadmapData}
              >
                📥 Download .drawio
              </button>
            </div>
          </div>
          {copyStatus && <div className="copy-status">{copyStatus}</div>}
          <div className="preview">
            {svgString ? (
              <div
                className="svg-container"
                dangerouslySetInnerHTML={{ __html: svgString }}
              />
            ) : (
              <div className="preview-placeholder">
                Enter roadmap text to see preview
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>
          Supports arbitrary time periods • Swimlanes for teams • Mathematical
          expressions for timing (e.g., <code>Q1+(Q2-Q1)/2</code>)
        </p>
      </footer>
    </div>
  );
}

export default App;
