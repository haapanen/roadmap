import type { RoadmapData } from "./types";

export function roadmapDataToText(data: RoadmapData): string {
  const lines: string[] = [];

  if (data.title) {
    lines.push(`# ${data.title}`);
    lines.push("");
  }

  lines.push("## Periods");
  lines.push(data.timePeriods.map((p) => p.label).join(", "));
  lines.push("");

  for (const swimlane of data.swimlanes) {
    lines.push(`## ${swimlane.label}`);
    for (const item of swimlane.items) {
      let itemLine = `- ${item.title} | start: ${item.startExpression}`;
      if (item.lengthExpression) {
        itemLine += ` | length: ${item.lengthExpression}`;
      } else if (item.endExpression) {
        itemLine += ` | end: ${item.endExpression}`;
      }
      if (item.color) {
        itemLine += ` | color: ${item.color}`;
      }
      lines.push(itemLine);
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}
