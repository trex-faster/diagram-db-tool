"use client";

import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";
import { useDiagramStore } from "@/store/diagramStore";
import type { SpecializationData } from "@/types/diagram";

export default function IsaLinkEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}: EdgeProps) {
  const nodes = useDiagramStore((s) => s.nodes);
  const specializationNode = nodes.find(
    (n) => (n.id === source || n.id === target) && n.type === "specialization"
  );
  const isTotal =
    specializationNode && (specializationNode.data as SpecializationData).completeness === "total";

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  if (!isTotal) {
    return <BaseEdge id={id} path={edgePath} style={{ stroke: "#374151", strokeWidth: 1.5 }} />;
  }

  // Participación/completitud total => línea doble (offset ligero de dos trazos paralelos).
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

  return (
    <>
      <BaseEdge id={`${id}-a`} path={path1} style={{ stroke: "#374151", strokeWidth: 1.5 }} />
      <BaseEdge id={`${id}-b`} path={path2} style={{ stroke: "#374151", strokeWidth: 1.5 }} />
    </>
  );
}
