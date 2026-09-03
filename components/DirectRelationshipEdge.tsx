"use client";

import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import { useDiagramStore } from "@/store/diagramStore";
import type { Cardinality, DirectRelationshipData } from "@/types/diagram";

const CARDINALITIES: Cardinality[] = ["1", "N", "0..1", "0..N", "1..N"];

export default function DirectRelationshipEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<DirectRelationshipData>) {
  const updateDirectRelationship = useDiagramStore((s) => s.updateDirectRelationship);
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const rel = data!;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          strokeWidth: rel.isIdentifying ? 3 : 1.5,
          stroke: "#7c2d12",
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
          }}
          className="flex items-center gap-1 rounded border border-orange-800 bg-white px-1 text-[10px] shadow"
        >
          <select
            value={rel.sourceCardinality}
            onChange={(e) =>
              updateDirectRelationship(id, { sourceCardinality: e.target.value as Cardinality })
            }
            className="bg-transparent"
          >
            {CARDINALITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            value={rel.name}
            onChange={(e) => updateDirectRelationship(id, { name: e.target.value })}
            className="w-16 bg-transparent text-center outline-none"
          />
          <select
            value={rel.targetCardinality}
            onChange={(e) =>
              updateDirectRelationship(id, { targetCardinality: e.target.value as Cardinality })
            }
            className="bg-transparent"
          >
            {CARDINALITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            title="Relación identificadora (entidad débil)"
            className={rel.isIdentifying ? "font-bold text-red-700" : "text-gray-400"}
            onClick={() => updateDirectRelationship(id, { isIdentifying: !rel.isIdentifying })}
          >
            ID
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
