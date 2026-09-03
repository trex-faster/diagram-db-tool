"use client";

import { useMemo } from "react";
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

  return (
    <div className="flex h-screen w-screen flex-col">
      <Toolbar />
      <div className="flex-1">
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
