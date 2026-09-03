"use client";

import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import { useDiagramStore } from "@/store/diagramStore";
import type { Cardinality, CardinalityLinkData } from "@/types/diagram";

const CARDINALITIES: Cardinality[] = ["1", "N", "0..1", "0..N", "1..N"];

export default function CardinalityLinkEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<CardinalityLinkData>) {
  const updateCardinalityLink = useDiagramStore((s) => s.updateCardinalityLink);
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const link = data!;

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={{ strokeWidth: 1.5, stroke: "#a16207" }} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
          }}
          className="rounded border border-yellow-700 bg-white px-1 text-[10px] shadow"
        >
          <select
            value={link.cardinality}
            onChange={(e) =>
              updateCardinalityLink(id, { cardinality: e.target.value as Cardinality })
            }
            className="bg-transparent"
          >
            {CARDINALITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
