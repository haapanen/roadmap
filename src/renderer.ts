import type { ResolvedRoadmap } from "./types";

export interface RenderOptions {
  width: number;
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
  width: 1200,
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
  const contentWidth = opts.width - opts.leftLabelWidth;
  const periodWidth = contentWidth / Math.max(roadmap.timePeriods.length, 1);

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

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${opts.width}" height="${totalHeight}" viewBox="0 0 ${opts.width} ${totalHeight}">
`;

  // Background
  svg += `  <rect width="${opts.width}" height="${totalHeight}" fill="#ffffff"/>\n`;

  // Title
  if (roadmap.title) {
    svg += `  <text x="${opts.width / 2}" y="20" text-anchor="middle" font-family="${opts.fontFamily}" font-size="18" font-weight="600" fill="#374151">${escapeXml(roadmap.title)}</text>\n`;
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
    svg += `  <rect x="0" y="${currentY}" width="${opts.width}" height="${height}" fill="${bgColor}"/>\n`;

    // Swimlane separator
    svg += `  <line x1="0" y1="${currentY}" x2="${opts.width}" y2="${currentY}" stroke="#e5e7eb" stroke-width="1"/>\n`;

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

      // Item text
      const textX = startX + 8;
      const maxTextWidth = itemWidth - 16;
      svg += `  <text x="${textX}" y="${itemY + opts.itemHeight / 2 + 5}" font-family="${opts.fontFamily}" font-size="${opts.fontSize - 2}" fill="#ffffff">${escapeXml(truncateText(item.title, maxTextWidth, opts.fontSize - 2))}</text>\n`;
    });

    currentY += height;
  });

  // Bottom border
  svg += `  <line x1="0" y1="${totalHeight - 1}" x2="${opts.width}" y2="${totalHeight - 1}" stroke="#d1d5db" stroke-width="1"/>\n`;

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
