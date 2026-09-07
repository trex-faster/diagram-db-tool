"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { useDiagramStore } from "@/store/diagramStore";
import type { RelationshipDiamondData } from "@/types/diagram";

export default function RelationshipDiamondNode({
  id,
  data,
}: NodeProps<Node<RelationshipDiamondData>>) {
  const renameRelationshipDiamond = useDiagramStore((s) => s.renameRelationshipDiamond);
  const toggleDiamondIdentifying = useDiagramStore((s) => s.toggleDiamondIdentifying);
  const toggleDiamondAssociative = useDiagramStore((s) => s.toggleDiamondAssociative);
  const deleteNode = useDiagramStore((s) => s.deleteNode);

  return (
    <div className="group relative flex h-24 w-32 items-center justify-center">
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Bottom} id="bottom" />

      <div
        className={`flex h-full w-full items-center justify-center bg-yellow-100 text-center text-xs shadow-md ${
          data.isIdentifying ? "border-4 border-double border-red-800" : "border-2 border-yellow-700"
        }`}
        style={{ clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" }}
      >
        <input
          className="w-20 bg-transparent text-center font-bold outline-none"
          value={data.name}
          onChange={(e) => renameRelationshipDiamond(id, e.target.value)}
        />
      </div>

      <div className="absolute -bottom-6 flex gap-1 opacity-0 group-hover:opacity-100">
        <button
          title="Relación identificadora (para entidad débil)"
          className={`rounded px-1 text-[9px] ${
            data.isIdentifying ? "bg-red-700 text-white" : "bg-gray-200 text-gray-600"
          }`}
          onClick={() => toggleDiamondIdentifying(id)}
        >
          ID
        </button>
        <button
          title="Relación asociativa"
          className={`rounded px-1 text-[9px] ${
            data.isAssociative ? "bg-purple-500 text-white" : "bg-gray-200 text-gray-600"
          }`}
          onClick={() => toggleDiamondAssociative(id)}
        >
          assoc
        </button>
        <button
          title="Eliminar esta relación — borra sus conexiones con las entidades"
          className="rounded bg-red-700 px-1 text-[9px] text-white hover:bg-red-800"
          onClick={() => deleteNode(id)}
        >
          🗑
        </button>
      </div>
    </div>
  );
}
