"use client";

import { useEffect, useMemo, useRef } from "react";
import { Background, Controls, MiniMap, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useDiagramStore } from "@/store/diagramStore";
import EntityNode from "./EntityNode";
import RelationshipDiamondNode from "./RelationshipDiamondNode";
import SpecializationNode from "./SpecializationNode";
import DirectRelationshipEdge from "./DirectRelationshipEdge";
import CardinalityLinkEdge from "./CardinalityLinkEdge";
import IsaLinkEdge from "./IsaLinkEdge";
import Toolbar from "./Toolbar";

export default function DiagramCanvas() {
  const nodes = useDiagramStore((s) => s.nodes);
  const edges = useDiagramStore((s) => s.edges);
  const onNodesChange = useDiagramStore((s) => s.onNodesChange);
  const onEdgesChange = useDiagramStore((s) => s.onEdgesChange);
  const onConnect = useDiagramStore((s) => s.onConnect);
  const undo = useDiagramStore((s) => s.undo);
  const redo = useDiagramStore((s) => s.redo);

  const canvasRef = useRef<HTMLDivElement>(null);

  const nodeTypes = useMemo(
    () => ({
      entity: EntityNode,
      relationshipDiamond: RelationshipDiamondNode,
      specialization: SpecializationNode,
    }),
    []
  );
  const edgeTypes = useMemo(
    () => ({
      direct: DirectRelationshipEdge,
      cardinalityLink: CardinalityLinkEdge,
      isaLink: IsaLinkEdge,
    }),
    []
  );

  // Atajos de teclado: Ctrl/Cmd+Z (undo), Ctrl/Cmd+Shift+Z o Ctrl/Cmd+Y (redo).
  // Se ignoran mientras el foco está en un input/select/textarea para no interferir
  // con la edición de texto normal (ej. seleccionar texto y borrarlo).
  useEffect(() => {
    function isEditableTarget(target: EventTarget | null): boolean {
      const el = target as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || el.isContentEditable;
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return;
      const ctrlOrCmd = e.ctrlKey || e.metaKey;
      if (!ctrlOrCmd) return;

      if (e.key.toLowerCase() === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if (e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      } else if (e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  return (
    <div className="flex h-screen w-screen flex-col">
      <Toolbar canvasRef={canvasRef} />
      <div className="flex-1" ref={canvasRef}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
    </div>
  );
}
