import { useState, useRef, useCallback, useMemo } from "react";
import type { ResolvedRoadmap } from "./types";

interface RenderOptions {
  periodWidth: number;
  headerHeight: number;
  swimlaneHeight: number;
  itemHeight: number;
  itemMargin: number;
  periodPadding: number;
  leftLabelWidth: number;
  fontSize: number;
  fontFamily: string;
}

const DEFAULT_OPTIONS: RenderOptions = {
  periodWidth: 150,
  headerHeight: 50,
  swimlaneHeight: 100,
  itemHeight: 36,
  itemMargin: 8,
  periodPadding: 10,
  leftLabelWidth: 150,
  fontSize: 14,
  fontFamily: "system-ui, -apple-system, sans-serif",
};

type DragMode = "move" | "resize-start" | "resize-end";

interface DragState {
  itemId: string;
  swimlaneId: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  itemOriginalX: number;
  itemOriginalY: number;
  mode: DragMode;
  originalStartIndex: number;
  originalEndIndex: number;
}

interface InteractiveSVGPreviewProps {
  roadmap: ResolvedRoadmap;
  options?: Partial<RenderOptions>;
  onItemMove?: (
    itemId: string,
    fromSwimlane: string,
    toSwimlane: string,
    newStartPeriod: string,
  ) => void;
  onItemResize?: (
    itemId: string,
    swimlaneId: string,
    newStartIndex: number,
    newLength: number,
  ) => void;
}

/**
 * Calculate relative luminance of a color
 */
function getLuminance(colorInput: string): number {
  const hex = colorToHex(colorInput);
  let color = hex.replace(/^#/, "");
  if (color.length === 3) {
    color = color[0] + color[0] + color[1] + color[1] + color[2] + color[2];
  }
  if (!/^[0-9A-Fa-f]{6}$/.test(color)) {
    return 0;
  }
  const r = parseInt(color.slice(0, 2), 16) / 255;
  const g = parseInt(color.slice(2, 4), 16) / 255;
  const b = parseInt(color.slice(4, 6), 16) / 255;
  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function colorToHex(color: string): string {
  if (/^#[0-9A-Fa-f]{3,6}$/.test(color)) {
    return color;
  }
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "#000000";
  ctx.fillStyle = color;
  const computedColor = ctx.fillStyle;
  if (computedColor.startsWith("#")) {
    return computedColor;
  }
  const match = computedColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    const r = parseInt(match[1]).toString(16).padStart(2, "0");
    const g = parseInt(match[2]).toString(16).padStart(2, "0");
    const b = parseInt(match[3]).toString(16).padStart(2, "0");
    return `#${r}${g}${b}`;
  }
  return "#000000";
}

function getContrastTextColor(bgColor: string): string {
  const luminance = getLuminance(bgColor);
  return luminance > 0.5 ? "#000000" : "#ffffff";
}

function calculateItemRows(
  items: { startIndex: number; endIndex: number }[],
): number {
  if (items.length === 0) return 1;
  const rows: { end: number }[] = [];
  const sortedItems = [...items].sort((a, b) => a.startIndex - b.startIndex);
  for (const item of sortedItems) {
    let assignedRow = -1;
    for (let r = 0; r < rows.length; r++) {
      if (rows[r].end <= item.startIndex) {
        assignedRow = r;
        rows[r].end = item.endIndex;
        break;
      }
    }
    if (assignedRow === -1) {
      rows.push({ end: item.endIndex });
    }
  }
  return Math.max(rows.length, 1);
}

function assignItemRows<T extends { startIndex: number; endIndex: number }>(
  items: T[],
): { item: T; row: number }[] {
  const rows: { end: number }[] = [];
  const result: { item: T; row: number }[] = [];
  const sortedItems = [...items].sort((a, b) => a.startIndex - b.startIndex);
  for (const item of sortedItems) {
    let assignedRow = -1;
    for (let r = 0; r < rows.length; r++) {
      if (rows[r].end <= item.startIndex) {
        assignedRow = r;
        rows[r].end = item.endIndex;
        break;
      }
    }
    if (assignedRow === -1) {
      assignedRow = rows.length;
      rows.push({ end: item.endIndex });
    }
    result.push({ item, row: assignedRow });
  }
  return result;
}

function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const charWidth = fontSize * 0.6;
  const maxChars = Math.floor(maxWidth / charWidth);
  if (maxChars <= 0) return [text];
  if (text.length <= maxChars) return [text];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length <= maxChars) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      if (word.length > maxChars) {
        let remaining = word;
        while (remaining.length > maxChars) {
          lines.push(remaining.slice(0, maxChars - 1) + "-");
          remaining = remaining.slice(maxChars - 1);
        }
        currentLine = remaining;
      } else {
        currentLine = word;
      }
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines.length > 0 ? lines : [text];
}

export function InteractiveSVGPreview({
  roadmap,
  options = {},
  onItemMove,
  onItemResize,
}: InteractiveSVGPreviewProps) {
  const opts = useMemo(() => ({ ...DEFAULT_OPTIONS, ...options }), [options]);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    periodIndex: number;
    swimlaneId: string;
  } | null>(null);

  // Helper to snap to 1 increments
  const snapToHalf = useCallback(
    (value: number): number => Math.round(value),
    [],
  );

  // Calculate dimensions
  const periodWidth = opts.periodWidth;
  const contentWidth = periodWidth * Math.max(roadmap.timePeriods.length, 1);
  const totalWidth = opts.leftLabelWidth + contentWidth;

  const swimlaneHeights = useMemo(
    () =>
      roadmap.swimlanes.map((sl) => {
        const rows = calculateItemRows(sl.items);
        return Math.max(
          opts.swimlaneHeight,
          rows * (opts.itemHeight + opts.itemMargin) + opts.itemMargin * 2,
        );
      }),
    [roadmap.swimlanes, opts.swimlaneHeight, opts.itemHeight, opts.itemMargin],
  );

  const totalHeight =
    opts.headerHeight + swimlaneHeights.reduce((a, b) => a + b, 0);

  // Pre-calculate swimlane Y positions
  const swimlanePositions = useMemo(() => {
    const positions: { id: string; y: number; height: number }[] = [];
    let currentY = opts.headerHeight;
    roadmap.swimlanes.forEach((sl, i) => {
      positions.push({ id: sl.id, y: currentY, height: swimlaneHeights[i] });
      currentY += swimlaneHeights[i];
    });
    return positions;
  }, [roadmap.swimlanes, swimlaneHeights, opts.headerHeight]);

  // Calculate item positions for rendering
  const itemPositions = useMemo(() => {
    const positions: Map<
      string,
      {
        x: number;
        y: number;
        width: number;
        height: number;
        swimlaneId: string;
      }
    > = new Map();

    let currentY = opts.headerHeight;
    roadmap.swimlanes.forEach((swimlane, swimlaneIndex) => {
      const height = swimlaneHeights[swimlaneIndex];
      const itemsWithRows = assignItemRows(swimlane.items);

      itemsWithRows.forEach(({ item, row }) => {
        const startX =
          opts.leftLabelWidth +
          item.startIndex * periodWidth +
          opts.periodPadding;
        const endX =
          opts.leftLabelWidth +
          item.endIndex * periodWidth -
          opts.periodPadding;
        const itemWidth = Math.max(endX - startX, 50);
        const itemY =
          currentY +
          opts.itemMargin +
          row * (opts.itemHeight + opts.itemMargin);

        positions.set(item.id, {
          x: startX,
          y: itemY,
          width: itemWidth,
          height: opts.itemHeight,
          swimlaneId: swimlane.id,
        });
      });

      currentY += height;
    });

    return positions;
  }, [roadmap.swimlanes, swimlaneHeights, opts, periodWidth]);

  const getSVGCoordinates = useCallback(
    (e: React.MouseEvent): { x: number; y: number } => {
      if (!svgRef.current) return { x: 0, y: 0 };
      const svg = svgRef.current;
      const rect = svg.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * totalWidth;
      const y = ((e.clientY - rect.top) / rect.height) * totalHeight;
      return { x, y };
    },
    [totalWidth, totalHeight],
  );

  const getPeriodFromX = useCallback(
    (x: number): number => {
      const relativeX = x - opts.leftLabelWidth;
      const periodIndex = Math.floor(relativeX / periodWidth);
      return Math.max(0, Math.min(periodIndex, roadmap.timePeriods.length - 1));
    },
    [opts.leftLabelWidth, periodWidth, roadmap.timePeriods.length],
  );

  // Get exact period position (floating point) for resize operations
  const getExactPeriodFromX = useCallback(
    (x: number): number => {
      const relativeX = x - opts.leftLabelWidth;
      const exactPeriod = relativeX / periodWidth;
      return Math.max(0, Math.min(exactPeriod, roadmap.timePeriods.length));
    },
    [opts.leftLabelWidth, periodWidth, roadmap.timePeriods.length],
  );

  const getSwimlaneFromY = useCallback(
    (y: number): string | null => {
      for (const pos of swimlanePositions) {
        if (y >= pos.y && y < pos.y + pos.height) {
          return pos.id;
        }
      }
      return null;
    },
    [swimlanePositions],
  );

  // Find item by id to get its indices
  const findItem = useCallback(
    (itemId: string) => {
      for (const sl of roadmap.swimlanes) {
        const item = sl.items.find((i) => i.id === itemId);
        if (item) return item;
      }
      return null;
    },
    [roadmap.swimlanes],
  );

  const handleMouseDown = useCallback(
    (
      e: React.MouseEvent,
      itemId: string,
      swimlaneId: string,
      mode: DragMode = "move",
    ) => {
      if (!onItemMove && mode === "move") return;
      if (!onItemResize && (mode === "resize-start" || mode === "resize-end"))
        return;
      e.preventDefault();
      e.stopPropagation();
      const coords = getSVGCoordinates(e);
      const pos = itemPositions.get(itemId);
      const item = findItem(itemId);
      if (!pos || !item) return;

      setDragState({
        itemId,
        swimlaneId,
        startX: coords.x,
        startY: coords.y,
        currentX: coords.x,
        currentY: coords.y,
        itemOriginalX: pos.x,
        itemOriginalY: pos.y,
        mode,
        originalStartIndex: item.startIndex,
        originalEndIndex: item.endIndex,
      });
    },
    [getSVGCoordinates, itemPositions, onItemMove, onItemResize, findItem],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragState) return;
      const coords = getSVGCoordinates(e);
      setDragState((prev) =>
        prev ? { ...prev, currentX: coords.x, currentY: coords.y } : null,
      );

      // Only calculate drop target for move mode
      if (dragState.mode === "move") {
        const periodIndex = getPeriodFromX(coords.x);
        const swimlaneId = getSwimlaneFromY(coords.y);
        if (swimlaneId) {
          setDropTarget({ periodIndex, swimlaneId });
        } else {
          setDropTarget(null);
        }
      }
    },
    [dragState, getSVGCoordinates, getPeriodFromX, getSwimlaneFromY],
  );

  const handleMouseUp = useCallback(() => {
    if (!dragState) {
      setDropTarget(null);
      return;
    }

    if (dragState.mode === "move" && dropTarget && onItemMove) {
      const period = roadmap.timePeriods[dropTarget.periodIndex];
      if (period) {
        onItemMove(
          dragState.itemId,
          dragState.swimlaneId,
          dropTarget.swimlaneId,
          period.label,
        );
      }
    } else if (
      (dragState.mode === "resize-start" || dragState.mode === "resize-end") &&
      onItemResize
    ) {
      const exactPeriod = getExactPeriodFromX(dragState.currentX);
      const snappedPeriod = snapToHalf(exactPeriod);

      let newStartIndex: number;
      let newEndIndex: number;

      if (dragState.mode === "resize-start") {
        // Resizing from start: change startIndex, keep endIndex
        newStartIndex = Math.max(
          0,
          Math.min(snappedPeriod, dragState.originalEndIndex - 1),
        );
        newEndIndex = dragState.originalEndIndex;
      } else {
        // Resizing from end: keep startIndex, change endIndex
        newStartIndex = dragState.originalStartIndex;
        newEndIndex = Math.max(
          dragState.originalStartIndex + 1,
          Math.min(snappedPeriod, roadmap.timePeriods.length),
        );
      }

      const newLength = newEndIndex - newStartIndex;
      if (newLength >= 1) {
        onItemResize(
          dragState.itemId,
          dragState.swimlaneId,
          newStartIndex,
          newLength,
        );
      }
    }

    setDragState(null);
    setDropTarget(null);
  }, [
    dragState,
    dropTarget,
    onItemMove,
    onItemResize,
    roadmap.timePeriods,
    getExactPeriodFromX,
    snapToHalf,
  ]);

  const handleMouseLeave = useCallback(() => {
    setDragState(null);
    setDropTarget(null);
  }, []);

  // Find the item being dragged
  const draggedItem = useMemo(() => {
    if (!dragState) return null;
    for (const sl of roadmap.swimlanes) {
      const item = sl.items.find((i) => i.id === dragState.itemId);
      if (item) return item;
    }
    return null;
  }, [dragState, roadmap.swimlanes]);

  // Calculate drag offset for move mode
  const dragOffset =
    dragState && dragState.mode === "move"
      ? {
          dx: dragState.currentX - dragState.startX,
          dy: dragState.currentY - dragState.startY,
        }
      : { dx: 0, dy: 0 };

  // Calculate resize preview dimensions
  const resizePreview = useMemo(() => {
    if (!dragState || dragState.mode === "move") return null;

    const exactPeriod = getExactPeriodFromX(dragState.currentX);
    const snappedPeriod = snapToHalf(exactPeriod);

    let newStartIndex: number;
    let newEndIndex: number;

    if (dragState.mode === "resize-start") {
      newStartIndex = Math.max(
        0,
        Math.min(snappedPeriod, dragState.originalEndIndex - 1),
      );
      newEndIndex = dragState.originalEndIndex;
    } else {
      newStartIndex = dragState.originalStartIndex;
      newEndIndex = Math.max(
        dragState.originalStartIndex + 1,
        Math.min(snappedPeriod, roadmap.timePeriods.length),
      );
    }

    const newX =
      opts.leftLabelWidth + newStartIndex * periodWidth + opts.periodPadding;
    const newWidth =
      (newEndIndex - newStartIndex) * periodWidth - opts.periodPadding * 2;

    return {
      x: newX,
      width: Math.max(newWidth, 20),
      newLength: newEndIndex - newStartIndex,
    };
  }, [
    dragState,
    getExactPeriodFromX,
    snapToHalf,
    opts.leftLabelWidth,
    opts.periodPadding,
    periodWidth,
    roadmap.timePeriods.length,
  ]);

  // Determine cursor based on drag state
  const getCursor = () => {
    if (!dragState) return "default";
    if (dragState.mode === "resize-start" || dragState.mode === "resize-end")
      return "ew-resize";
    return "grabbing";
  };

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      width={totalWidth}
      height={totalHeight}
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      style={{ cursor: getCursor() }}
    >
      {/* Background */}
      <rect width={totalWidth} height={totalHeight} fill="#ffffff" />

      {/* Title */}
      {roadmap.title && (
        <text
          x={totalWidth / 2}
          y={20}
          textAnchor="middle"
          fontFamily={opts.fontFamily}
          fontSize={18}
          fontWeight={600}
          fill="#374151"
        >
          {roadmap.title}
        </text>
      )}

      {/* Header row with period labels */}
      <rect
        x={opts.leftLabelWidth}
        y={0}
        width={contentWidth}
        height={opts.headerHeight}
        fill="#f3f4f6"
      />

      {roadmap.timePeriods.map((period, i) => {
        const x = opts.leftLabelWidth + i * periodWidth;
        return (
          <g key={period.id}>
            {i > 0 && (
              <line
                x1={x}
                y1={0}
                x2={x}
                y2={totalHeight}
                stroke="#d1d5db"
                strokeWidth={1}
              />
            )}
            <text
              x={x + periodWidth / 2}
              y={opts.headerHeight / 2 + 5}
              textAnchor="middle"
              fontFamily={opts.fontFamily}
              fontSize={opts.fontSize}
              fontWeight={600}
              fill="#374151"
            >
              {period.label}
            </text>
          </g>
        );
      })}

      {/* Left column background */}
      <rect
        x={0}
        y={0}
        width={opts.leftLabelWidth}
        height={totalHeight}
        fill="#f9fafb"
      />
      <line
        x1={opts.leftLabelWidth}
        y1={0}
        x2={opts.leftLabelWidth}
        y2={totalHeight}
        stroke="#d1d5db"
        strokeWidth={1}
      />

      {/* Swimlanes */}
      {roadmap.swimlanes.map((swimlane, swimlaneIndex) => {
        const currentY = swimlanePositions[swimlaneIndex].y;
        const height = swimlaneHeights[swimlaneIndex];
        const bgColor = swimlaneIndex % 2 === 0 ? "#ffffff" : "#fafafa";

        return (
          <g key={swimlane.id}>
            {/* Swimlane background */}
            <rect
              x={0}
              y={currentY}
              width={totalWidth}
              height={height}
              fill={bgColor}
            />

            {/* Drop target highlight */}
            {dropTarget && dropTarget.swimlaneId === swimlane.id && (
              <rect
                x={opts.leftLabelWidth + dropTarget.periodIndex * periodWidth}
                y={currentY}
                width={periodWidth}
                height={height}
                fill="rgba(66, 133, 244, 0.15)"
                stroke="#4285F4"
                strokeWidth={2}
                strokeDasharray="4"
              />
            )}

            {/* Swimlane separator */}
            <line
              x1={0}
              y1={currentY}
              x2={totalWidth}
              y2={currentY}
              stroke="#e5e7eb"
              strokeWidth={1}
            />

            {/* Swimlane label */}
            <text
              x={opts.leftLabelWidth / 2}
              y={currentY + height / 2 + 5}
              textAnchor="middle"
              fontFamily={opts.fontFamily}
              fontSize={opts.fontSize}
              fontWeight={600}
              fill="#1f2937"
            >
              {swimlane.label}
            </text>

            {/* Items */}
            {assignItemRows(swimlane.items).map(({ item }) => {
              const pos = itemPositions.get(item.id);
              if (!pos) return null;

              const isDragging = dragState?.itemId === item.id;

              const textColor = getContrastTextColor(item.color);
              const textX = pos.x + 8;
              const maxTextWidth = pos.width - 16;
              const textFontSize = opts.fontSize - 2;
              const lineHeight = textFontSize * 1.2;
              const verticalPadding = 6;
              const availableHeight = opts.itemHeight - verticalPadding * 2;
              const maxLines = Math.max(
                1,
                Math.floor(availableHeight / lineHeight),
              );

              let lines = wrapText(item.title, maxTextWidth, textFontSize);
              if (lines.length > maxLines) {
                lines = lines.slice(0, maxLines);
                const lastLine = lines[maxLines - 1];
                const charWidth = textFontSize * 0.6;
                const maxChars = Math.floor(maxTextWidth / charWidth);
                lines[maxLines - 1] =
                  lastLine.length > maxChars - 1
                    ? lastLine.slice(0, maxChars - 1) + "…"
                    : lastLine + "…";
              }

              const totalTextHeight = lines.length * lineHeight;
              const textStartY =
                pos.y +
                (opts.itemHeight - totalTextHeight) / 2 +
                textFontSize * 0.85;

              const isResizing = isDragging && dragState?.mode !== "move";
              const isMoveDragging = isDragging && dragState?.mode === "move";

              // For resize preview, use the calculated new dimensions
              const displayX =
                isResizing && resizePreview
                  ? resizePreview.x
                  : isMoveDragging
                    ? pos.x + dragOffset.dx
                    : pos.x;
              const displayY = isMoveDragging ? pos.y + dragOffset.dy : pos.y;
              const displayWidth =
                isResizing && resizePreview ? resizePreview.width : pos.width;

              const handleWidth = 8;

              return (
                <g
                  key={item.id}
                  style={{
                    opacity: isDragging ? 0.8 : 1,
                  }}
                >
                  {/* Main item rect - draggable for move */}
                  <rect
                    x={displayX}
                    y={displayY}
                    width={displayWidth}
                    height={pos.height}
                    rx={4}
                    ry={4}
                    fill={item.color}
                    stroke={isDragging ? "#000" : "none"}
                    strokeWidth={isDragging ? 2 : 0}
                    style={{ cursor: onItemMove ? "grab" : "default" }}
                    onMouseDown={(e) =>
                      handleMouseDown(e, item.id, swimlane.id, "move")
                    }
                  />

                  {/* Left resize handle */}
                  {onItemResize && !isMoveDragging && (
                    <rect
                      x={displayX}
                      y={displayY}
                      width={handleWidth}
                      height={pos.height}
                      rx={4}
                      ry={4}
                      fill="transparent"
                      style={{ cursor: "ew-resize" }}
                      onMouseDown={(e) =>
                        handleMouseDown(e, item.id, swimlane.id, "resize-start")
                      }
                    />
                  )}

                  {/* Right resize handle */}
                  {onItemResize && !isMoveDragging && (
                    <rect
                      x={displayX + displayWidth - handleWidth}
                      y={displayY}
                      width={handleWidth}
                      height={pos.height}
                      rx={4}
                      ry={4}
                      fill="transparent"
                      style={{ cursor: "ew-resize" }}
                      onMouseDown={(e) =>
                        handleMouseDown(e, item.id, swimlane.id, "resize-end")
                      }
                    />
                  )}

                  {/* Only render text at original position to avoid complexity */}
                  {!isMoveDragging &&
                    lines.map((line, lineIndex) => (
                      <text
                        key={lineIndex}
                        x={
                          isResizing && resizePreview
                            ? resizePreview.x + 8
                            : textX
                        }
                        y={textStartY + lineIndex * lineHeight}
                        fontFamily={opts.fontFamily}
                        fontSize={textFontSize}
                        fill={textColor}
                        style={{ pointerEvents: "none" }}
                      >
                        {line}
                      </text>
                    ))}
                </g>
              );
            })}
          </g>
        );
      })}

      {/* Dragged item overlay (rendered on top) - only for move mode */}
      {dragState && dragState.mode === "move" && draggedItem && (
        <g style={{ pointerEvents: "none" }}>
          {(() => {
            const pos = itemPositions.get(draggedItem.id);
            if (!pos) return null;

            const itemX = pos.x + dragOffset.dx;
            const itemY = pos.y + dragOffset.dy;

            const textColor = getContrastTextColor(draggedItem.color);
            const textX = itemX + 8;
            const maxTextWidth = pos.width - 16;
            const textFontSize = opts.fontSize - 2;
            const lineHeight = textFontSize * 1.2;
            const verticalPadding = 6;
            const availableHeight = opts.itemHeight - verticalPadding * 2;
            const maxLines = Math.max(
              1,
              Math.floor(availableHeight / lineHeight),
            );

            let lines = wrapText(draggedItem.title, maxTextWidth, textFontSize);
            if (lines.length > maxLines) {
              lines = lines.slice(0, maxLines);
              const lastLine = lines[maxLines - 1];
              const charWidth = textFontSize * 0.6;
              const maxChars = Math.floor(maxTextWidth / charWidth);
              lines[maxLines - 1] =
                lastLine.length > maxChars - 1
                  ? lastLine.slice(0, maxChars - 1) + "…"
                  : lastLine + "…";
            }

            const totalTextHeight = lines.length * lineHeight;
            const textStartY =
              itemY +
              (opts.itemHeight - totalTextHeight) / 2 +
              textFontSize * 0.85;

            return (
              <>
                <rect
                  x={itemX}
                  y={itemY}
                  width={pos.width}
                  height={pos.height}
                  rx={4}
                  ry={4}
                  fill={draggedItem.color}
                  stroke="#000"
                  strokeWidth={2}
                  filter="drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3))"
                />
                {lines.map((line, lineIndex) => (
                  <text
                    key={lineIndex}
                    x={textX}
                    y={textStartY + lineIndex * lineHeight}
                    fontFamily={opts.fontFamily}
                    fontSize={textFontSize}
                    fill={textColor}
                  >
                    {line}
                  </text>
                ))}
              </>
            );
          })()}
        </g>
      )}

      {/* Bottom border */}
      <line
        x1={0}
        y1={totalHeight - 1}
        x2={totalWidth}
        y2={totalHeight - 1}
        stroke="#d1d5db"
        strokeWidth={1}
      />
    </svg>
  );
}
