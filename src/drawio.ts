import pako from "pako";
import type { ResolvedRoadmap } from "./types";

/**
 * Compress and encode XML for draw.io format
 * draw.io expects: URL-encoded -> deflate-compressed -> base64-encoded
 */
function compressForDrawio(xml: string): string {
  // URL encode the XML
  const urlEncoded = encodeURIComponent(xml);
  // Deflate compress
  const compressed = pako.deflateRaw(urlEncoded, { level: 9 });
  // Base64 encode
  const base64 = btoa(
    String.fromCharCode.apply(null, compressed as unknown as number[]),
  );
  return base64;
}

/**
 * Generate draw.io compatible XML
 *
 * draw.io uses mxGraph XML format for diagrams
 */
export function generateDrawioXml(roadmap: ResolvedRoadmap): string {
  const cellWidth = 150;
  const headerHeight = 40;
  const swimlaneHeight = 80;
  const itemHeight = 30;
  const leftLabelWidth = 120;

  const contentWidth = roadmap.timePeriods.length * cellWidth;
  const totalWidth = leftLabelWidth + contentWidth;

  // Calculate swimlane heights
  const swimlaneHeights = roadmap.swimlanes.map((sl) => {
    const rows = calculateRows(sl.items);
    return Math.max(swimlaneHeight, rows * (itemHeight + 10) + 20);
  });

  const totalHeight = headerHeight + swimlaneHeights.reduce((a, b) => a + b, 0);

  const cells: string[] = [];
  let cellId = 2; // 0 and 1 are reserved

  // Header cells for time periods
  roadmap.timePeriods.forEach((period, i) => {
    const x = leftLabelWidth + i * cellWidth;
    cells.push(
      createCell(
        cellId++,
        period.label,
        x,
        0,
        cellWidth,
        headerHeight,
        "#f3f4f6",
        "#374151",
        true,
      ),
    );
  });

  // Swimlane labels and items
  let currentY = headerHeight;

  roadmap.swimlanes.forEach((swimlane, swimlaneIndex) => {
    const height = swimlaneHeights[swimlaneIndex];

    // Swimlane label
    cells.push(
      createCell(
        cellId++,
        swimlane.label,
        0,
        currentY,
        leftLabelWidth,
        height,
        "#f9fafb",
        "#1f2937",
        true,
      ),
    );

    // Items
    const itemsWithRows = assignRows(swimlane.items);

    itemsWithRows.forEach(({ item, row }) => {
      const startX = leftLabelWidth + item.startIndex * cellWidth + 5;
      const width = (item.endIndex - item.startIndex) * cellWidth - 10;
      const itemY = currentY + 10 + row * (itemHeight + 10);
      const textColor = getContrastTextColor(item.color);

      cells.push(
        createCell(
          cellId++,
          item.title,
          startX,
          itemY,
          width,
          itemHeight,
          item.color,
          textColor,
          false,
        ),
      );
    });

    currentY += height;
  });

  // Build the mxGraphModel XML
  const xml = `<mxGraphModel dx="0" dy="0" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${totalWidth}" pageHeight="${totalHeight}">
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
${cells.join("\n")}
  </root>
</mxGraphModel>`;

  return xml;
}

function createCell(
  id: number,
  label: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fillColor: string,
  fontColor: string,
  isHeader: boolean,
): string {
  const style = isHeader
    ? `rounded=0;whiteSpace=wrap;html=1;fillColor=${fillColor};strokeColor=#d1d5db;fontColor=${fontColor};fontStyle=1;align=center;verticalAlign=middle;`
    : `rounded=1;whiteSpace=wrap;html=1;fillColor=${fillColor};strokeColor=none;fontColor=${fontColor};align=left;verticalAlign=middle;spacingLeft=8;`;

  return `    <mxCell id="${id}" value="${escapeXml(label)}" style="${style}" vertex="1" parent="1">
      <mxGeometry x="${x}" y="${y}" width="${width}" height="${height}" as="geometry"/>
    </mxCell>`;
}

function calculateRows(
  items: { startIndex: number; endIndex: number }[],
): number {
  if (items.length === 0) return 1;

  const rows: { end: number }[] = [];
  const sortedItems = [...items].sort((a, b) => a.startIndex - b.startIndex);

  for (const item of sortedItems) {
    let placed = false;
    for (const row of rows) {
      if (row.end <= item.startIndex) {
        row.end = item.endIndex;
        placed = true;
        break;
      }
    }
    if (!placed) {
      rows.push({ end: item.endIndex });
    }
  }

  return Math.max(rows.length, 1);
}

function assignRows<T extends { startIndex: number; endIndex: number }>(
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
 * Copy draw.io XML to clipboard
 *
 * draw.io uses the same mxfile format for clipboard as for files
 */
export async function copyDrawioToClipboard(
  roadmap: ResolvedRoadmap,
): Promise<void> {
  const xml = generateDrawioXml(roadmap);

  // Compress for draw.io format (same as file download)
  const compressed = compressForDrawio(xml);

  // Wrap in draw.io file format - same structure as downloadDrawio
  const drawioXml = `<mxfile host="app.diagrams.net" modified="${new Date().toISOString()}" agent="Roadmap Tool" version="1.0" type="device">
  <diagram name="Roadmap" id="roadmap-diagram">
    ${compressed}
  </diagram>
</mxfile>`;

  // Copy to clipboard
  await navigator.clipboard.writeText(drawioXml);
}

/**
 * Download as .drawio file
 */
export function downloadDrawio(
  roadmap: ResolvedRoadmap,
  filename: string = "roadmap.drawio",
): void {
  const xml = generateDrawioXml(roadmap);

  // Compress for draw.io file format (URL encode -> deflate -> base64)
  const compressed = compressForDrawio(xml);

  // Wrap in draw.io file format
  const drawioFile = `<mxfile host="app.diagrams.net" modified="${new Date().toISOString()}" agent="Roadmap Tool" version="1.0" type="device">
  <diagram name="Roadmap" id="roadmap-diagram">
    ${compressed}
  </diagram>
</mxfile>`;

  const blob = new Blob([drawioFile], { type: "application/xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
