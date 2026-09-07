"use client";

import { BaseEdge, EdgeLabelRenderer, getBezierPath, type Edge, type EdgeProps } from "@xyflow/react";
import { useDiagramStore } from "@/store/diagramStore";
import { isManyCardinality, type Cardinality, type DirectRelationshipData } from "@/types/diagram";

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
}: EdgeProps<Edge<DirectRelationshipData>>) {
  const updateDirectRelationship = useDiagramStore((s) => s.updateDirectRelationship);
  const materializeForeignKey = useDiagramStore((s) => s.materializeForeignKey);
  const materializeJunctionTable = useDiagramStore((s) => s.materializeJunctionTable);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const rel = data!;
  const sourceMany = isManyCardinality(rel.sourceCardinality);
  const targetMany = isManyCardinality(rel.targetCardinality);
  const isOneToMany = sourceMany !== targetMany; // exactamente uno de los dos lados es "muchos"
  const isManyToMany = sourceMany && targetMany;

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
          className="flex flex-col items-center gap-1 rounded border border-orange-800 bg-white px-1 py-1 text-[10px] shadow"
        >
          <div className="flex items-center gap-1">
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

          {isOneToMany &&
            (rel.materializedFk ? (
              <span className="text-green-700" title="Ya se generó la columna FK real (con su índice) en el lado 'muchos'.">
                ✓ FK generada
              </span>
            ) : (
              <button
                className="rounded bg-blue-600 px-1 py-0.5 font-bold text-white hover:bg-blue-700"
                title="Genera la columna FK real (+ índice) en el lado 'muchos', siguiendo la convención tabla_columna"
                onClick={() => materializeForeignKey(id)}
              >
                Generar FK →
              </button>
            ))}

          {isManyToMany &&
            (rel.materializedJunctionEntityId ? (
              <span className="text-green-700" title="Ya se generó la tabla intermedia con sus 2 FKs indexadas.">
                ✓ Tabla intermedia generada
              </span>
            ) : (
              <button
                className="rounded bg-purple-600 px-1 py-0.5 font-bold text-white hover:bg-purple-700"
                title="Genera la tabla intermedia (con 2 FKs indexadas + PK compuesta) para esta relación N:M"
                onClick={() => materializeJunctionTable(id)}
              >
                Generar tabla intermedia
              </button>
            ))}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
