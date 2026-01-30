import { useState, useEffect } from "react";
import type { RoadmapData, TimePeriod, Swimlane, RoadmapItem } from "./types";

interface UIEditorProps {
  initialData?: RoadmapData;
  onDataChange: (data: RoadmapData) => void;
}

interface EditableItem {
  id: string;
  title: string;
  startPeriod: string;
  length: number;
  color: string;
}

interface EditableSwimlane {
  id: string;
  label: string;
  items: EditableItem[];
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export function UIEditor({ initialData, onDataChange }: UIEditorProps) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [periodsText, setPeriodsText] = useState(
    initialData?.timePeriods.map((p) => p.label).join(", ") || "Q1, Q2, Q3, Q4",
  );
  const [swimlanes, setSwimlanes] = useState<EditableSwimlane[]>(() => {
    if (initialData?.swimlanes && initialData.swimlanes.length > 0) {
      return initialData.swimlanes.map((sl) => ({
        id: sl.id,
        label: sl.label,
        items: sl.items.map((item) => ({
          id: item.id,
          title: item.title,
          startPeriod: item.startExpression,
          length: parseInt(item.lengthExpression || "1", 10) || 1,
          color: item.color || "",
        })),
      }));
    }
    return [
      {
        id: generateId(),
        label: "Team",
        items: [],
      },
    ];
  });

  const periods = periodsText
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  // Sync changes to parent whenever state changes
  useEffect(() => {
    const timePeriods: TimePeriod[] = periods.map((label, index) => ({
      id: label.replace(/\s+/g, "_"),
      label,
      index,
    }));

    const roadmapSwimlanes: Swimlane[] = swimlanes.map((sl) => ({
      id: sl.id,
      label: sl.label,
      items: sl.items.map(
        (item): RoadmapItem => ({
          id: item.id,
          title: item.title,
          startExpression: item.startPeriod || periods[0] || "Q1",
          endExpression: undefined,
          lengthExpression: item.length.toString(),
          swimlane: sl.id,
          color: item.color || undefined,
        }),
      ),
    }));

    const data: RoadmapData = {
      title: title || undefined,
      timePeriods,
      swimlanes: roadmapSwimlanes,
    };

    onDataChange(data);
  }, [title, periods, swimlanes, onDataChange]);

  const addSwimlane = () => {
    setSwimlanes((prev) => [
      ...prev,
      {
        id: generateId(),
        label: `Team ${prev.length + 1}`,
        items: [],
      },
    ]);
  };

  const removeSwimlane = (swimlaneId: string) => {
    setSwimlanes((prev) => prev.filter((sl) => sl.id !== swimlaneId));
  };

  const updateSwimlaneLabel = (swimlaneId: string, label: string) => {
    setSwimlanes((prev) =>
      prev.map((sl) => (sl.id === swimlaneId ? { ...sl, label } : sl)),
    );
  };

  const addItem = (swimlaneId: string) => {
    setSwimlanes((prev) =>
      prev.map((sl) =>
        sl.id === swimlaneId
          ? {
              ...sl,
              items: [
                ...sl.items,
                {
                  id: generateId(),
                  title: "New Item",
                  startPeriod: periods[0] || "Q1",
                  length: 1,
                  color: "",
                },
              ],
            }
          : sl,
      ),
    );
  };

  const removeItem = (swimlaneId: string, itemId: string) => {
    setSwimlanes((prev) =>
      prev.map((sl) =>
        sl.id === swimlaneId
          ? { ...sl, items: sl.items.filter((item) => item.id !== itemId) }
          : sl,
      ),
    );
  };

  const updateItem = (
    swimlaneId: string,
    itemId: string,
    updates: Partial<EditableItem>,
  ) => {
    setSwimlanes((prev) =>
      prev.map((sl) =>
        sl.id === swimlaneId
          ? {
              ...sl,
              items: sl.items.map((item) =>
                item.id === itemId ? { ...item, ...updates } : item,
              ),
            }
          : sl,
      ),
    );
  };

  const moveSwimlane = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= swimlanes.length) return;

    setSwimlanes((prev) => {
      const newSwimlanes = [...prev];
      [newSwimlanes[index], newSwimlanes[newIndex]] = [
        newSwimlanes[newIndex],
        newSwimlanes[index],
      ];
      return newSwimlanes;
    });
  };

  return (
    <div className="ui-editor">
      <div className="ui-editor-section">
        <label className="ui-editor-label">
          Roadmap Title
          <input
            type="text"
            className="ui-editor-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="My Roadmap"
          />
        </label>
      </div>

      <div className="ui-editor-section">
        <label className="ui-editor-label">
          Time Periods (comma-separated)
          <input
            type="text"
            className="ui-editor-input"
            value={periodsText}
            onChange={(e) => setPeriodsText(e.target.value)}
            placeholder="Q1, Q2, Q3, Q4"
          />
        </label>
        {periods.length > 0 && (
          <div className="ui-editor-periods-preview">
            {periods.map((p, i) => (
              <span key={i} className="ui-editor-period-tag">
                {p}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="ui-editor-section">
        <div className="ui-editor-section-header">
          <h3>Swimlanes</h3>
          <button className="btn btn-secondary btn-small" onClick={addSwimlane}>
            + Add Swimlane
          </button>
        </div>

        {swimlanes.map((swimlane, swimlaneIndex) => (
          <div key={swimlane.id} className="ui-editor-swimlane">
            <div className="ui-editor-swimlane-header">
              <div className="ui-editor-swimlane-controls">
                <button
                  className="btn btn-icon"
                  onClick={() => moveSwimlane(swimlaneIndex, "up")}
                  disabled={swimlaneIndex === 0}
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  className="btn btn-icon"
                  onClick={() => moveSwimlane(swimlaneIndex, "down")}
                  disabled={swimlaneIndex === swimlanes.length - 1}
                  title="Move down"
                >
                  ↓
                </button>
              </div>
              <input
                type="text"
                className="ui-editor-swimlane-name"
                value={swimlane.label}
                onChange={(e) =>
                  updateSwimlaneLabel(swimlane.id, e.target.value)
                }
                placeholder="Swimlane name"
              />
              <button
                className="btn btn-danger btn-small"
                onClick={() => removeSwimlane(swimlane.id)}
                title="Remove swimlane"
              >
                ✕
              </button>
            </div>

            <div className="ui-editor-items">
              {swimlane.items.map((item) => (
                <div key={item.id} className="ui-editor-item">
                  <div className="ui-editor-item-row">
                    <input
                      type="text"
                      className="ui-editor-item-title"
                      value={item.title}
                      onChange={(e) =>
                        updateItem(swimlane.id, item.id, {
                          title: e.target.value,
                        })
                      }
                      placeholder="Item title"
                    />
                    <button
                      className="btn btn-danger btn-icon"
                      onClick={() => removeItem(swimlane.id, item.id)}
                      title="Remove item"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="ui-editor-item-row ui-editor-item-timing">
                    <label className="ui-editor-inline-label">
                      Start:
                      <select
                        className="ui-editor-select"
                        value={item.startPeriod}
                        onChange={(e) =>
                          updateItem(swimlane.id, item.id, {
                            startPeriod: e.target.value,
                          })
                        }
                      >
                        {periods.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="ui-editor-inline-label">
                      Length:
                      <input
                        type="number"
                        className="ui-editor-number"
                        min="1"
                        value={item.length}
                        onChange={(e) =>
                          updateItem(swimlane.id, item.id, {
                            length: parseInt(e.target.value, 10) || 1,
                          })
                        }
                      />
                    </label>

                    <label className="ui-editor-inline-label">
                      <input
                        type="checkbox"
                        checked={!!item.color}
                        onChange={(e) =>
                          updateItem(swimlane.id, item.id, {
                            color: e.target.checked ? "#4285F4" : "",
                          })
                        }
                      />
                      Custom color
                    </label>

                    {item.color && (
                      <input
                        type="color"
                        className="ui-editor-color"
                        value={item.color}
                        onChange={(e) =>
                          updateItem(swimlane.id, item.id, {
                            color: e.target.value,
                          })
                        }
                      />
                    )}
                  </div>
                </div>
              ))}

              <button
                className="btn btn-secondary btn-small ui-editor-add-item"
                onClick={() => addItem(swimlane.id)}
              >
                + Add Item
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
