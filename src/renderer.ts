import type { ResolvedRoadmap } from "./types";

export interface RenderOptions {
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

/**
 * Render roadmap to SVG string
 */
export function renderToSVG(
  roadmap: ResolvedRoadmap,
  options: Partial<RenderOptions> = {},
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Calculate dimensions
  const periodWidth = opts.periodWidth;
  const contentWidth = periodWidth * Math.max(roadmap.timePeriods.length, 1);
  const totalWidth = opts.leftLabelWidth + contentWidth;

  // Calculate swimlane heights based on item count
  const swimlaneHeights = roadmap.swimlanes.map((sl) => {
    const rows = calculateItemRows(sl.items);
    return Math.max(
      opts.swimlaneHeight,
      rows * (opts.itemHeight + opts.itemMargin) + opts.itemMargin * 2,
    );
  });

  const totalHeight =
    opts.headerHeight + swimlaneHeights.reduce((a, b) => a + b, 0);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}">
`;

  // Background
  svg += `  <rect width="${totalWidth}" height="${totalHeight}" fill="#ffffff"/>\n`;

  // Title
  if (roadmap.title) {
    svg += `  <text x="${totalWidth / 2}" y="20" text-anchor="middle" font-family="${opts.fontFamily}" font-size="18" font-weight="600" fill="#374151">${escapeXml(roadmap.title)}</text>\n`;
  }

  // Header row with period labels
  svg += `  <rect x="${opts.leftLabelWidth}" y="0" width="${contentWidth}" height="${opts.headerHeight}" fill="#f3f4f6"/>\n`;

  roadmap.timePeriods.forEach((period, i) => {
    const x = opts.leftLabelWidth + i * periodWidth;
    // Period separator
    if (i > 0) {
      svg += `  <line x1="${x}" y1="0" x2="${x}" y2="${totalHeight}" stroke="#d1d5db" stroke-width="1"/>\n`;
    }
    // Period label
    svg += `  <text x="${x + periodWidth / 2}" y="${opts.headerHeight / 2 + 5}" text-anchor="middle" font-family="${opts.fontFamily}" font-size="${opts.fontSize}" font-weight="600" fill="#374151">${escapeXml(period.label)}</text>\n`;
  });

  // Left column background
  svg += `  <rect x="0" y="0" width="${opts.leftLabelWidth}" height="${totalHeight}" fill="#f9fafb"/>\n`;
  svg += `  <line x1="${opts.leftLabelWidth}" y1="0" x2="${opts.leftLabelWidth}" y2="${totalHeight}" stroke="#d1d5db" stroke-width="1"/>\n`;

  // Swimlanes
  let currentY = opts.headerHeight;

  roadmap.swimlanes.forEach((swimlane, swimlaneIndex) => {
    const height = swimlaneHeights[swimlaneIndex];

    // Swimlane background (alternating)
    const bgColor = swimlaneIndex % 2 === 0 ? "#ffffff" : "#fafafa";
    svg += `  <rect x="0" y="${currentY}" width="${totalWidth}" height="${height}" fill="${bgColor}"/>\n`;

    // Swimlane separator
    svg += `  <line x1="0" y1="${currentY}" x2="${totalWidth}" y2="${currentY}" stroke="#e5e7eb" stroke-width="1"/>\n`;

    // Swimlane label
    svg += `  <text x="${opts.leftLabelWidth / 2}" y="${currentY + height / 2 + 5}" text-anchor="middle" font-family="${opts.fontFamily}" font-size="${opts.fontSize}" font-weight="600" fill="#1f2937">${escapeXml(swimlane.label)}</text>\n`;

    // Render items with row packing
    const itemsWithRows = assignItemRows(swimlane.items);

    itemsWithRows.forEach(({ item, row }) => {
      const startX =
        opts.leftLabelWidth +
        item.startIndex * periodWidth +
        opts.periodPadding;
      const endX =
        opts.leftLabelWidth + item.endIndex * periodWidth - opts.periodPadding;
      const itemWidth = Math.max(endX - startX, 50);
      const itemY =
        currentY + opts.itemMargin + row * (opts.itemHeight + opts.itemMargin);

      // Item rectangle with rounded corners
      svg += `  <rect x="${startX}" y="${itemY}" width="${itemWidth}" height="${opts.itemHeight}" rx="4" ry="4" fill="${item.color}"/>\n`;

      // Item text - use black or white based on background contrast
      const textColor = getContrastTextColor(item.color);
      const textX = startX + 8;
      const maxTextWidth = itemWidth - 16;
      svg += `  <text x="${textX}" y="${itemY + opts.itemHeight / 2 + 5}" font-family="${opts.fontFamily}" font-size="${opts.fontSize - 2}" fill="${textColor}">${escapeXml(truncateText(item.title, maxTextWidth, opts.fontSize - 2))}</text>\n`;
    });

    currentY += height;
  });

  // Bottom border
  svg += `  <line x1="0" y1="${totalHeight - 1}" x2="${totalWidth}" y2="${totalHeight - 1}" stroke="#d1d5db" stroke-width="1"/>\n`;

  svg += "</svg>";

  return svg;
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

function truncateText(
  text: string,
  maxWidth: number,
  fontSize: number,
): string {
  // Approximate character width
  const charWidth = fontSize * 0.6;
  const maxChars = Math.floor(maxWidth / charWidth);

  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 1) + "…";
}

/**
 * Convert a named color to hex using a canvas
 */
function colorToHex(color: string): string {
  // If already a hex color, return as-is
  if (/^#[0-9A-Fa-f]{3,6}$/.test(color)) {
    return color;
  }

  // Use a temporary canvas to convert named colors to hex
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "#000000";

  ctx.fillStyle = color;
  const computedColor = ctx.fillStyle; // Browser converts to hex or rgb

  // If it's already hex, return it
  if (computedColor.startsWith("#")) {
    return computedColor;
  }

  // Parse rgb/rgba format
  const match = computedColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    const r = parseInt(match[1]).toString(16).padStart(2, "0");
    const g = parseInt(match[2]).toString(16).padStart(2, "0");
    const b = parseInt(match[3]).toString(16).padStart(2, "0");
    return `#${r}${g}${b}`;
  }

  return "#000000";
}

/**
 * Calculate relative luminance of a color
 * Based on WCAG 2.0 formula
 */
function getLuminance(colorInput: string): number {
  const hex = colorToHex(colorInput);
  // Remove # if present and handle shorthand
  let color = hex.replace(/^#/, "");
  if (color.length === 3) {
    color = color[0] + color[0] + color[1] + color[1] + color[2] + color[2];
  }

  // If not a valid hex, return 0 (assume dark background)
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

/**
 * Get contrast text color (black or white) for a background color
 * Uses WCAG contrast ratio guidelines
 */
function getContrastTextColor(bgColor: string): string {
  const luminance = getLuminance(bgColor);
  // Use white text for dark backgrounds, black text for light backgrounds
  return luminance > 0.5 ? "#000000" : "#ffffff";
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Convert SVG to data URL for preview
 */
export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Download SVG as file
 */
export function downloadSVG(
  svg: string,
  filename: string = "roadmap.svg",
): void {
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
