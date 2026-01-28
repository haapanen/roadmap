import type {
  RoadmapData,
  TimePeriod,
  Swimlane,
  RoadmapItem,
  ResolvedRoadmap,
  ResolvedItem,
} from "./types";

const COLORS = [
  "#4285F4",
  "#EA4335",
  "#FBBC04",
  "#34A853",
  "#FF6D01",
  "#46BDC6",
  "#7BAAF7",
  "#F07B72",
  "#FCD04F",
  "#57BB8A",
  "#9E69AF",
  "#FF8A80",
  "#A7FFEB",
  "#FFD180",
  "#B388FF",
];

/**
 * Parse roadmap text input into structured data
 *
 * Format:
 * # Title (optional)
 *
 * ## Periods
 * Q1, Q2, Q3, Q4
 *
 * ## Swimlane: Team Name
 * - Item name | start: Q1 | end: Q3
 * - Item name | start: Q2 | length: 2
 * - Item name | start: Q1+(Q2-Q1)/2 | end: Q4
 */
export function parseRoadmapText(text: string): RoadmapData {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const timePeriods: TimePeriod[] = [];
  const swimlanes: Swimlane[] = [];
  let title: string | undefined;

  let currentSwimlane: Swimlane | null = null;
  let parsingSection: "none" | "periods" | "swimlane" = "none";
  let itemCounter = 0;

  for (const line of lines) {
    // Title
    if (line.startsWith("# ") && !line.startsWith("## ")) {
      title = line.slice(2).trim();
      continue;
    }

    // Section header
    if (line.startsWith("## ")) {
      const header = line.slice(3).trim().toLowerCase();

      if (
        header === "periods" ||
        header === "time periods" ||
        header === "timeline"
      ) {
        parsingSection = "periods";
        continue;
      }

      if (
        header.startsWith("swimlane:") ||
        header.startsWith("team:") ||
        header.startsWith("lane:")
      ) {
        const label = line.slice(3).split(":")[1]?.trim() || "Default";
        currentSwimlane = {
          id: `swimlane-${swimlanes.length}`,
          label,
          items: [],
        };
        swimlanes.push(currentSwimlane);
        parsingSection = "swimlane";
        continue;
      }

      // Generic swimlane header
      const label = line.slice(3).trim();
      if (label) {
        currentSwimlane = {
          id: `swimlane-${swimlanes.length}`,
          label,
          items: [],
        };
        swimlanes.push(currentSwimlane);
        parsingSection = "swimlane";
        continue;
      }
    }

    // Parse periods (comma-separated)
    if (
      parsingSection === "periods" &&
      !line.startsWith("#") &&
      !line.startsWith("-")
    ) {
      const periods = line
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
      for (const period of periods) {
        timePeriods.push({
          id: period.replace(/\s+/g, "_"),
          label: period,
          index: timePeriods.length,
        });
      }
      continue;
    }

    // Parse items in swimlane
    if (parsingSection === "swimlane" && line.startsWith("-")) {
      if (!currentSwimlane) {
        currentSwimlane = {
          id: "swimlane-default",
          label: "Default",
          items: [],
        };
        swimlanes.push(currentSwimlane);
      }

      const item = parseItem(
        line.slice(1).trim(),
        itemCounter++,
        currentSwimlane.id,
      );
      if (item) {
        currentSwimlane.items.push(item);
      }
    }
  }

  // Default periods if none specified
  if (timePeriods.length === 0) {
    ["Q1", "Q2", "Q3", "Q4"].forEach((label, index) => {
      timePeriods.push({ id: label, label, index });
    });
  }

  return { timePeriods, swimlanes, title };
}

function parseItem(
  text: string,
  index: number,
  swimlane: string,
): RoadmapItem | null {
  // Format: Title | start: X | end: Y or length: N | color: #hex
  const parts = text.split("|").map((p) => p.trim());

  if (parts.length === 0) return null;

  const title = parts[0];
  let startExpression = "";
  let endExpression: string | undefined;
  let lengthExpression: string | undefined;
  let color: string | undefined;

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i].toLowerCase();
    const value = parts[i].split(":")[1]?.trim();

    if (part.startsWith("start:")) {
      startExpression = value || "";
    } else if (part.startsWith("end:")) {
      endExpression = value;
    } else if (part.startsWith("length:")) {
      lengthExpression = value;
    } else if (part.startsWith("color:")) {
      color = value;
    }
  }

  // Default start to first period
  if (!startExpression) {
    startExpression = "0";
  }

  return {
    id: `item-${index}`,
    title,
    startExpression,
    endExpression,
    lengthExpression,
    swimlane,
    color,
  };
}

/**
 * Resolve expressions to numeric indices
 */
export function resolveRoadmap(data: RoadmapData): ResolvedRoadmap {
  const periodMap = new Map<string, number>();
  data.timePeriods.forEach((p, i) => {
    periodMap.set(p.id.toLowerCase(), i);
    periodMap.set(p.label.toLowerCase(), i);
  });

  let colorIndex = 0;

  const resolvedSwimlanes = data.swimlanes.map((swimlane) => ({
    id: swimlane.id,
    label: swimlane.label,
    items: swimlane.items.map((item) => {
      const resolved = resolveItem(
        item,
        periodMap,
        data.timePeriods.length,
        colorIndex,
      );
      colorIndex++;
      return resolved;
    }),
  }));

  return {
    timePeriods: data.timePeriods,
    swimlanes: resolvedSwimlanes,
    title: data.title,
  };
}

function resolveItem(
  item: RoadmapItem,
  periodMap: Map<string, number>,
  totalPeriods: number,
  colorIndex: number,
): ResolvedItem {
  const startIndex = evaluateExpression(
    item.startExpression,
    periodMap,
    totalPeriods,
  );

  let endIndex: number;

  if (item.endExpression) {
    endIndex = evaluateExpression(item.endExpression, periodMap, totalPeriods);
  } else if (item.lengthExpression) {
    const length = evaluateExpression(
      item.lengthExpression,
      periodMap,
      totalPeriods,
    );
    endIndex = startIndex + length;
  } else {
    // Default length of 1 period
    endIndex = startIndex + 1;
  }

  // Ensure end is after start
  if (endIndex <= startIndex) {
    endIndex = startIndex + 1;
  }

  return {
    id: item.id,
    title: item.title,
    startIndex,
    endIndex,
    swimlane: item.swimlane,
    color: item.color || COLORS[colorIndex % COLORS.length],
  };
}

function evaluateExpression(
  expr: string,
  periodMap: Map<string, number>,
  _totalPeriods: number,
): number {
  if (!expr) return 0;

  // First check if it's a simple number
  const simpleNum = parseFloat(expr);
  if (!isNaN(simpleNum)) return simpleNum;

  // Replace period references with their indices
  let evaluated = expr.toLowerCase();

  // Sort by length descending to replace longer names first
  const sortedPeriods = Array.from(periodMap.entries()).sort(
    (a, b) => b[0].length - a[0].length,
  );

  for (const [name, index] of sortedPeriods) {
    evaluated = evaluated.replace(
      new RegExp(escapeRegex(name), "gi"),
      index.toString(),
    );
  }

  // Now evaluate the mathematical expression
  try {
    // Safe evaluation - only allow numbers and basic math operators
    const sanitized = evaluated.replace(/[^0-9+\-*/().]/g, "");
    if (sanitized.length === 0) return 0;

    // Use Function constructor for safe math evaluation
    const result = new Function(`return ${sanitized}`)();
    return typeof result === "number" && !isNaN(result) ? result : 0;
  } catch {
    return 0;
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Generate example roadmap text
 */
export function getExampleText(): string {
  return `# Product Roadmap 2026

## Periods
Q1 2026, Q2 2026, Q3 2026, Q4 2026

## Frontend Team
- New Design System | start: Q1 2026 | end: Q2 2026 | color: #4285F4
- Dashboard Redesign | start: Q2 2026 | length: 2 | color: #EA4335
- Mobile App | start: Q3 2026 | end: Q4 2026 | color: #FBBC04

## Backend Team
- API v2 | start: Q1 2026 | end: Q3 2026 | color: #34A853
- Database Migration | start: Q2 2026 | length: 1 | color: #FF6D01
- Microservices | start: Q3 2026 | end: Q4 2026 | color: #46BDC6

## DevOps
- CI/CD Pipeline | start: Q1 2026 | length: 1 | color: #9E69AF
- Kubernetes Setup | start: Q2 2026 | end: Q4 2026 | color: #7BAAF7`;
}
