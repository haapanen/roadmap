// Roadmap data types

export interface TimePeriod {
  id: string;
  label: string;
  index: number;
}

export interface RoadmapItem {
  id: string;
  title: string;
  startExpression: string;
  endExpression?: string;
  lengthExpression?: string;
  swimlane: string;
  color?: string;
}

export interface Swimlane {
  id: string;
  label: string;
  items: RoadmapItem[];
}

export interface RoadmapData {
  timePeriods: TimePeriod[];
  swimlanes: Swimlane[];
  title?: string;
}

export interface ResolvedItem {
  id: string;
  title: string;
  startIndex: number;
  endIndex: number;
  swimlane: string;
  color: string;
}

export interface ResolvedRoadmap {
  timePeriods: TimePeriod[];
  swimlanes: {
    id: string;
    label: string;
    items: ResolvedItem[];
  }[];
  title?: string;
}
