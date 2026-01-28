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

      cells.push(
        createCell(
          cellId++,
          item.title,
          startX,
          itemY,
          width,
          itemHeight,
          item.color,
          "#ffffff",
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
