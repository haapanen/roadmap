import { useState, useMemo, useCallback, useEffect } from "react";
import "./App.css";
import { parseRoadmapText, resolveRoadmap, getExampleText } from "./parser";
import { renderToSVG, downloadSVG } from "./renderer";
import { copyDrawioToClipboard, downloadDrawio } from "./drawio";
import { UIEditor } from "./UIEditor";
import { roadmapDataToText } from "./roadmapUtils";
import { InteractiveSVGPreview } from "./InteractiveSVGPreview";
import { Tutorial, useTutorial } from "./Tutorial";
import type { RoadmapData } from "./types";

function parsePalette(paletteText: string): string[] {
  if (!paletteText.trim()) return [];

  // Support both comma-separated and newline-separated colors
  const colors = paletteText
    .split(/[,\n]+/)
    .map((c) => c.trim())
    .filter((c) => c.length > 0 && /^#?[0-9A-Fa-f]{3,8}$|^[a-zA-Z]+$/.test(c))
    .map((c) => (c.startsWith("#") || /^[a-zA-Z]+$/.test(c) ? c : `#${c}`));

  return colors;
}

interface UrlOptions {
  palette: string;
  periodWidth: number;
  itemHeight: number;
  data?: string;
}

function getOptionsFromUrl(): Partial<UrlOptions> {
  const params = new URLSearchParams(window.location.search);
  const options: Partial<UrlOptions> = {};

  const data = params.get("data");
  if (data !== null) {
    try {
      options.data = decodeURIComponent(atob(data));
    } catch (e) {
      console.error("Failed to decode data from URL:", e);
    }
  }

  const palette = params.get("palette");
  if (palette !== null) {
    options.palette = palette;
  }

  const periodWidth = params.get("periodWidth");
  if (periodWidth !== null) {
    const parsed = parseInt(periodWidth, 10);
    if (!isNaN(parsed) && parsed >= 50) {
      options.periodWidth = parsed;
    }
  }

  const itemHeight = params.get("itemHeight");
  if (itemHeight !== null) {
    const parsed = parseInt(itemHeight, 10);
    if (!isNaN(parsed) && parsed >= 20) {
      options.itemHeight = parsed;
    }
  }

  return options;
}

function updateUrlWithOptions(options: UrlOptions): void {
  const params = new URLSearchParams();

  if (options.palette) {
    params.set("palette", options.palette);
  }
  if (options.periodWidth !== 150) {
    params.set("periodWidth", options.periodWidth.toString());
  }
  if (options.itemHeight !== 36) {
    params.set("itemHeight", options.itemHeight.toString());
  }

  const newUrl = params.toString()
    ? `${window.location.pathname}?${params.toString()}`
    : window.location.pathname;

  window.history.replaceState({}, "", newUrl);
}

function App() {
  const urlOptions = useMemo(() => getOptionsFromUrl(), []);
  const { showTutorial, endTutorial, resetTutorial } = useTutorial();

  const [editorMode, setEditorMode] = useState<"text" | "ui">("text");
  const [inputText, setInputText] = useState(
    urlOptions.data ?? getExampleText(),
  );
  const [paletteText, setPaletteText] = useState<string>(
    urlOptions.palette ?? "",
  );
  const [periodWidth, setPeriodWidth] = useState<number>(
    urlOptions.periodWidth ?? 150,
  );
  const [itemHeight, setItemHeight] = useState<number>(
    urlOptions.itemHeight ?? 36,
  );
  const [copyStatus, setCopyStatus] = useState<string>("");
  const [uiEditorKey, setUiEditorKey] = useState(0);

  // Parse current text for UI editor whenever switching to UI mode
  const currentUIData = useMemo(() => {
    try {
      return parseRoadmapText(inputText);
    } catch {
      return undefined;
    }
  }, [inputText]);

  const handleUIDataChange = useCallback((data: RoadmapData) => {
    const text = roadmapDataToText(data);
    setInputText(text);
  }, []);

  // Handle item move from drag-and-drop in the SVG preview
  const handleItemMove = useCallback(
    (
      itemId: string,
      fromSwimlane: string,
      toSwimlane: string,
      newStartPeriod: string,
    ) => {
      try {
        const parsed = parseRoadmapText(inputText);

        // Find the item and update it
        let itemFound = false;
        for (const swimlane of parsed.swimlanes) {
          const itemIndex = swimlane.items.findIndex(
            (item) => item.id === itemId,
          );
          if (itemIndex !== -1) {
            const item = swimlane.items[itemIndex];

            // Update the start period
            item.startExpression = newStartPeriod;

            // If moving to a different swimlane
            if (fromSwimlane !== toSwimlane) {
              // Remove from current swimlane
              swimlane.items.splice(itemIndex, 1);

              // Add to target swimlane
              const targetSwimlane = parsed.swimlanes.find(
                (sl) => sl.id === toSwimlane,
              );
              if (targetSwimlane) {
                item.swimlane = toSwimlane;
                targetSwimlane.items.push(item);
              }
            }

            itemFound = true;
            break;
          }
        }

        if (itemFound) {
          const text = roadmapDataToText(parsed);
          setInputText(text);
          // Refresh UI editor if in UI mode
          if (editorMode === "ui") {
            setUiEditorKey((k) => k + 1);
          }
        }
      } catch (e) {
        console.error("Error updating item:", e);
      }
    },
    [inputText, editorMode],
  );

  // Handle item resize from drag-and-drop in the SVG preview
  const handleItemResize = useCallback(
    (
      itemId: string,
      _swimlaneId: string,
      newStartIndex: number,
      newLength: number,
    ) => {
      try {
        const parsed = parseRoadmapText(inputText);

        // Find the item and update it
        let itemFound = false;
        for (const swimlane of parsed.swimlanes) {
          const itemIndex = swimlane.items.findIndex(
            (item) => item.id === itemId,
          );
          if (itemIndex !== -1) {
            const item = swimlane.items[itemIndex];

            // Get the period label for the new start index
            const periodIndex = Math.floor(newStartIndex);
            const period = parsed.timePeriods[periodIndex];
            if (period) {
              item.startExpression = period.label;
            }

            // Update the length expression
            item.lengthExpression = newLength.toString();

            itemFound = true;
            break;
          }
        }

        if (itemFound) {
          const text = roadmapDataToText(parsed);
          setInputText(text);
          // Refresh UI editor if in UI mode
          if (editorMode === "ui") {
            setUiEditorKey((k) => k + 1);
          }
        }
      } catch (e) {
        console.error("Error resizing item:", e);
      }
    },
    [inputText, editorMode],
  );

  // When switching to UI mode, increment key to remount with fresh data
  const handleSwitchToUI = useCallback(() => {
    setUiEditorKey((k) => k + 1);
    setEditorMode("ui");
  }, []);

  // Sync options to URL when they change
  useEffect(() => {
    updateUrlWithOptions({
      palette: paletteText,
      periodWidth,
      itemHeight,
    });
  }, [paletteText, periodWidth, itemHeight]);

  const palette = useMemo(() => parsePalette(paletteText), [paletteText]);

  const roadmapData = useMemo(() => {
    try {
      const parsed = parseRoadmapText(inputText);
      return resolveRoadmap(parsed, palette.length > 0 ? palette : undefined);
    } catch (e) {
      console.error("Parse error:", e);
      return null;
    }
  }, [inputText, palette]);

  const svgString = useMemo(() => {
    if (!roadmapData) return "";
    return renderToSVG(roadmapData, { periodWidth, itemHeight });
  }, [roadmapData, periodWidth, itemHeight]);

  const handleCopyDrawio = useCallback(async () => {
    if (!roadmapData) return;
    try {
      await copyDrawioToClipboard(roadmapData, { periodWidth, itemHeight });
      setCopyStatus("Copied draw.io XML to clipboard!");
      setTimeout(() => setCopyStatus(""), 3000);
    } catch (e) {
      console.error("Clipboard error:", e);
      setCopyStatus(
        `Failed to copy: ${e instanceof Error ? e.message : "Unknown error"}`,
      );
      setTimeout(() => setCopyStatus(""), 3000);
    }
  }, [roadmapData, periodWidth, itemHeight]);

  const handleDownloadSVG = useCallback(() => {
    if (!svgString) return;
    downloadSVG(svgString, "roadmap.svg");
  }, [svgString]);

  const handleDownloadDrawio = useCallback(() => {
    if (!roadmapData) return;
    downloadDrawio(roadmapData, "roadmap.drawio", { periodWidth, itemHeight });
  }, [roadmapData, periodWidth, itemHeight]);

  const handleCopySVG = useCallback(async () => {
    if (!svgString) return;
    try {
      await navigator.clipboard.writeText(svgString);
      setCopyStatus("Copied SVG to clipboard!");
      setTimeout(() => setCopyStatus(""), 3000);
    } catch {
      setCopyStatus("Failed to copy SVG");
      setTimeout(() => setCopyStatus(""), 3000);
    }
  }, [svgString]);

  const handleCopyPNG = useCallback(async () => {
    if (!svgString) return;
    try {
      // Parse SVG to get dimensions
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgString, "image/svg+xml");
      const svgElement = svgDoc.documentElement;
      const width = parseInt(svgElement.getAttribute("width") || "800", 10);
      const height = parseInt(svgElement.getAttribute("height") || "600", 10);

      // Create canvas with 2x scale for better quality
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Failed to get canvas context");

      // Fill with white background
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);

      // Create image from SVG
      const img = new Image();
      const svgBlob = new Blob([svgString], {
        type: "image/svg+xml;charset=utf-8",
      });
      const url = URL.createObjectURL(svgBlob);

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
          URL.revokeObjectURL(url);
          resolve();
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("Failed to load SVG image"));
        };
        img.src = url;
      });

      // Convert to blob and copy to clipboard
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error("Failed to create PNG blob"));
        }, "image/png");
      });

      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);

      setCopyStatus("Copied PNG to clipboard!");
      setTimeout(() => setCopyStatus(""), 3000);
    } catch (e) {
      console.error("PNG copy error:", e);
      setCopyStatus(
        `Failed to copy PNG: ${e instanceof Error ? e.message : "Unknown error"}`,
      );
      setTimeout(() => setCopyStatus(""), 3000);
    }
  }, [svgString]);

  const handleCopyShareUrl = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      const encodedData = btoa(encodeURIComponent(inputText));
      params.set("data", encodedData);
      if (paletteText) {
        params.set("palette", paletteText);
      }
      if (periodWidth !== 150) {
        params.set("periodWidth", periodWidth.toString());
      }
      if (itemHeight !== 36) {
        params.set("itemHeight", itemHeight.toString());
      }
      const shareUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopyStatus("Copied share URL to clipboard!");
      setTimeout(() => setCopyStatus(""), 3000);
    } catch {
      setCopyStatus("Failed to copy URL");
      setTimeout(() => setCopyStatus(""), 3000);
    }
  }, [inputText, paletteText, periodWidth, itemHeight]);

  return (
    <div className="app">
      {showTutorial && <Tutorial onComplete={endTutorial} />}
      <header className="header">
        <h1>
          <svg
            className="roadmap-icon"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Timeline bars representing a Gantt chart */}
            <rect
              x="2"
              y="4"
              width="10"
              height="3"
              rx="1.5"
              fill="currentColor"
            />
            <rect
              x="6"
              y="10"
              width="12"
              height="3"
              rx="1.5"
              fill="currentColor"
            />
            <rect
              x="10"
              y="16"
              width="12"
              height="3"
              rx="1.5"
              fill="currentColor"
            />
          </svg>
          Text to Roadmap
        </h1>
        <p>Convert text to visual roadmap diagrams</p>
        <div className="header-actions">
          <button className="tutorial-restart-btn" onClick={resetTutorial}>
            <span>❓</span> Show Tutorial
          </button>
        </div>
      </header>

      <main className="main">
        <section className="editor-section">
          <div className="section-header">
            <h2>Input</h2>
            {editorMode === "text" && (
              <button
                className="btn btn-secondary"
                onClick={() => setInputText(getExampleText())}
              >
                Load Example
              </button>
            )}
          </div>

          <div className="editor-tabs">
            <button
              className={`editor-tab ${editorMode === "text" ? "active" : ""}`}
              onClick={() => setEditorMode("text")}
            >
              📝 Text
            </button>
            <button
              className={`editor-tab ${editorMode === "ui" ? "active" : ""}`}
              onClick={handleSwitchToUI}
            >
              🎛️ Visual
            </button>
          </div>

          {editorMode === "text" ? (
            <>
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
                <strong>Format:</strong> Use <code># Title</code> for roadmap
                title,
                <code>## Periods</code> followed by comma-separated periods,
                then <code>## Team Name</code> sections with items like
                <code>- Task | start: Q1 | end: Q3</code> or
                <code>- Task | start: Q1 | length: 2</code>
              </div>
            </>
          ) : (
            <UIEditor
              key={uiEditorKey}
              initialData={currentUIData}
              onDataChange={handleUIDataChange}
            />
          )}

          <div className="palette-section">
            <div className="section-header">
              <h3>🎨 Color Palette (optional)</h3>
              {palette.length > 0 && (
                <button
                  className="btn btn-secondary btn-small"
                  onClick={() => setPaletteText("")}
                >
                  Clear
                </button>
              )}
            </div>
            <textarea
              className="palette-input"
              value={paletteText}
              onChange={(e) => setPaletteText(e.target.value)}
              placeholder="Paste colors (comma or newline separated):
#4285F4, #EA4335, #FBBC04
or
#4285F4
#EA4335
#FBBC04"
              spellCheck={false}
            />
            {palette.length > 0 && (
              <div className="palette-preview">
                {palette.map((color, i) => (
                  <div
                    key={i}
                    className="palette-swatch"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="period-width-section">
            <div className="section-header">
              <h3>📏 Period Width</h3>
              <div className="period-width-input-wrapper">
                <input
                  type="number"
                  className="period-width-input"
                  min="50"
                  value={periodWidth}
                  onChange={(e) =>
                    setPeriodWidth(Math.max(50, Number(e.target.value) || 50))
                  }
                />
                <span className="period-width-unit">px</span>
              </div>
            </div>
            <input
              type="range"
              className="period-width-slider"
              min="50"
              max="300"
              value={Math.min(periodWidth, 300)}
              onChange={(e) => setPeriodWidth(Number(e.target.value))}
            />
            <div className="period-width-labels">
              <span>50px</span>
              <span>300px</span>
            </div>
          </div>

          <div className="period-width-section">
            <div className="section-header">
              <h3>📐 Item Height</h3>
              <div className="period-width-input-wrapper">
                <input
                  type="number"
                  className="period-width-input"
                  min="20"
                  value={itemHeight}
                  onChange={(e) =>
                    setItemHeight(Math.max(20, Number(e.target.value) || 20))
                  }
                />
                <span className="period-width-unit">px</span>
              </div>
            </div>
            <input
              type="range"
              className="period-width-slider"
              min="20"
              max="80"
              value={Math.min(itemHeight, 80)}
              onChange={(e) => setItemHeight(Number(e.target.value))}
            />
            <div className="period-width-labels">
              <span>20px</span>
              <span>80px</span>
            </div>
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
                className="btn btn-primary"
                onClick={handleCopyPNG}
                disabled={!svgString}
              >
                🖼️ Copy PNG
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
              <button
                className="btn btn-secondary"
                onClick={handleCopyShareUrl}
              >
                🔗 Copy Share URL
              </button>
            </div>
          </div>
          {copyStatus && <div className="copy-status">{copyStatus}</div>}
          <div className="preview">
            {roadmapData ? (
              <div className="svg-container">
                <InteractiveSVGPreview
                  roadmap={roadmapData}
                  options={{ periodWidth, itemHeight }}
                  onItemMove={handleItemMove}
                  onItemResize={handleItemResize}
                />
              </div>
            ) : (
              <div className="preview-placeholder">
                Enter roadmap text to see preview
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
