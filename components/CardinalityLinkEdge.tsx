"use client";

import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import { useDiagramStore } from "@/store/diagramStore";
import type { Cardinality, CardinalityLinkData, Participation } from "@/types/diagram";

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
  const link = data!;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Participación TOTAL (Elmasri/Navathe): línea doble — toda instancia de la entidad
  // debe participar en la relación. PARCIAL: línea simple (por defecto).
  let paths = [edgePath];
  if (link.participation === "total") {
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const offsetX = (-dy / len) * 2.5;
    const offsetY = (dx / len) * 2.5;
    const [path1] = getBezierPath({
      sourceX: sourceX + offsetX,
      sourceY: sourceY + offsetY,
      sourcePosition,
      targetX: targetX + offsetX,
      targetY: targetY + offsetY,
      targetPosition,
    });
    const [path2] = getBezierPath({
      sourceX: sourceX - offsetX,
      sourceY: sourceY - offsetY,
      sourcePosition,
      targetX: targetX - offsetX,
      targetY: targetY - offsetY,
      targetPosition,
    });
    paths = [path1, path2];
  }

  return (
    <>
      {paths.map((p, i) => (
        <BaseEdge key={i} id={`${id}-${i}`} path={p} style={{ strokeWidth: 1.5, stroke: "#a16207" }} />
      ))}
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
          }}
          className="flex items-center gap-1 rounded border border-yellow-700 bg-white px-1 text-[10px] shadow"
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
          <input
            value={link.role ?? ""}
            onChange={(e) => updateCardinalityLink(id, { role: e.target.value })}
            placeholder="rol"
            title="Rol (importante en relaciones recursivas / n-arias)"
            className="w-14 bg-transparent text-center outline-none placeholder:text-gray-300"
          />
          <button
            title="Participación: parcial (línea simple) / total (línea doble)"
            className={link.participation === "total" ? "font-bold text-red-700" : "text-gray-400"}
            onClick={() =>
              updateCardinalityLink(id, {
                participation: (link.participation === "total"
                  ? "partial"
                  : "total") as Participation,
              })
            }
          >
            {link.participation === "total" ? "TOTAL" : "parcial"}
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
