import { create } from "zustand";
import {
  type Connection,
  type Edge,
  type Node,
  type OnEdgesChange,
  type OnNodesChange,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
} from "@xyflow/react";
import type {
  Attribute,
  CardinalityLinkData,
  DirectRelationshipData,
  EntityData,
  IndexDef,
  RelationshipDiamondData,
} from "@/types/diagram";

// crypto.randomUUID() está disponible nativamente en navegadores modernos y en Node 19+,
// así evitamos la dependencia extra de "uuid".
const uuid = () => crypto.randomUUID();

type AnyNodeData = EntityData | RelationshipDiamondData;
type AnyEdgeData = DirectRelationshipData | CardinalityLinkData;

interface DiagramState {
  nodes: Node<AnyNodeData>[];
  edges: Edge<AnyEdgeData>[];

  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: Connection) => void;

  // Entidades
  addEntity: (position: { x: number; y: number }) => void;
  addAttribute: (entityId: string) => void;
  updateAttribute: (entityId: string, attributeId: string, patch: Partial<Attribute>) => void;
  removeAttribute: (entityId: string, attributeId: string) => void;
  renameEntity: (entityId: string, name: string) => void;
  toggleEntityKind: (entityId: string) => void;
  toggleEntityAssociative: (entityId: string) => void;

  // Foreign keys reales
  linkForeignKey: (
    entityId: string,
    attributeId: string,
    target: { entityId: string; attributeId: string } | null
  ) => void;

  // Índices
  addIndex: (entityId: string) => void;
  updateIndex: (entityId: string, indexId: string, patch: Partial<IndexDef>) => void;
  removeIndex: (entityId: string, indexId: string) => void;
  toggleIndexAttribute: (entityId: string, indexId: string, attributeId: string) => void;

  // Diamantes de relación (notación Chen)
  addRelationshipDiamond: (position: { x: number; y: number }) => void;
  renameRelationshipDiamond: (nodeId: string, name: string) => void;
  toggleDiamondIdentifying: (nodeId: string) => void;
  toggleDiamondAssociative: (nodeId: string) => void;

  // Edges
  updateDirectRelationship: (edgeId: string, patch: Partial<DirectRelationshipData>) => void;
  updateCardinalityLink: (edgeId: string, patch: Partial<CardinalityLinkData>) => void;

  exportDiagram: () => string;
  importDiagram: (json: string) => void;
  reset: () => void;
}

function defaultAttribute(name: string, isPrimaryKey = false): Attribute {
  return {
    id: uuid(),
    name,
    type: "integer",
    nullable: false,
    isPrimaryKey,
    isForeignKey: false,
    isPartialKey: false,
    isUnique: false,
  };
}

function newEntityNode(position: { x: number; y: number }): Node<EntityData> {
  const id = uuid();
  return {
    id,
    type: "entity",
    position,
    data: {
      name: "nueva_entidad",
      kind: "strong",
      isAssociative: false,
      attributes: [defaultAttribute("id", true)],
      indexes: [],
    },
  };
}

function newRelationshipDiamond(position: { x: number; y: number }): Node<RelationshipDiamondData> {
  return {
    id: uuid(),
    type: "relationshipDiamond",
    position,
    data: {
      name: "relacion",
      isIdentifying: false,
      isAssociative: false,
    },
  };
}

function isEntityNode(node: Node<AnyNodeData> | undefined): node is Node<EntityData> {
  return node?.type === "entity";
}

export const useDiagramStore = create<DiagramState>((set, get) => ({
  nodes: [],
  edges: [],

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },

  onConnect: (connection) => {
    const { nodes, edges } = get();
    const sourceNode = nodes.find((n) => n.id === connection.source);
    const targetNode = nodes.find((n) => n.id === connection.target);

    const bothEntities = sourceNode?.type === "entity" && targetNode?.type === "entity";
    const involvesDiamond =
      sourceNode?.type === "relationshipDiamond" || targetNode?.type === "relationshipDiamond";

    if (bothEntities) {
      // Línea directa crow's foot, con nombre + cardinalidad en ambos lados.
      const newEdge: Edge<DirectRelationshipData> = {
        id: uuid(),
        source: connection.source!,
        target: connection.target!,
        type: "direct",
        data: {
          name: "relacion",
          sourceCardinality: "1",
          targetCardinality: "N",
          isIdentifying: false,
        },
      };
      set({ edges: addEdge(newEdge, edges) as Edge<AnyEdgeData>[] });
      return;
    }

    if (involvesDiamond) {
      // Conexión entidad <-> diamante: solo lleva la cardinalidad de ESE lado.
      const newEdge: Edge<CardinalityLinkData> = {
        id: uuid(),
        source: connection.source!,
        target: connection.target!,
        type: "cardinalityLink",
        data: { cardinality: "N" },
      };
      set({ edges: addEdge(newEdge, edges) as Edge<AnyEdgeData>[] });
      return;
    }
  },

  addEntity: (position) => {
    set({ nodes: [...get().nodes, newEntityNode(position)] });
  },

  addAttribute: (entityId) => {
    set({
      nodes: get().nodes.map((n) =>
        isEntityNode(n) && n.id === entityId
          ? {
              ...n,
              data: {
                ...n.data,
                attributes: [...n.data.attributes, defaultAttribute("nuevo_campo")],
              },
            }
          : n
      ),
    });
  },

  updateAttribute: (entityId, attributeId, patch) => {
    set({
      nodes: get().nodes.map((n) =>
        isEntityNode(n) && n.id === entityId
          ? {
              ...n,
              data: {
                ...n.data,
                attributes: n.data.attributes.map((a) =>
                  a.id === attributeId ? { ...a, ...patch } : a
                ),
              },
            }
          : n
      ),
    });
  },

  removeAttribute: (entityId, attributeId) => {
    set({
      nodes: get().nodes.map((n) =>
        isEntityNode(n) && n.id === entityId
          ? {
              ...n,
              data: {
                ...n.data,
                attributes: n.data.attributes.filter((a) => a.id !== attributeId),
                indexes: n.data.indexes.map((idx) => ({
                  ...idx,
                  attributeIds: idx.attributeIds.filter((id) => id !== attributeId),
                })),
              },
            }
          : n
      ),
    });
  },

  renameEntity: (entityId, name) => {
    set({
      nodes: get().nodes.map((n) =>
        isEntityNode(n) && n.id === entityId ? { ...n, data: { ...n.data, name } } : n
      ),
    });
  },

  toggleEntityKind: (entityId) => {
    set({
      nodes: get().nodes.map((n) =>
        isEntityNode(n) && n.id === entityId
          ? { ...n, data: { ...n.data, kind: n.data.kind === "strong" ? "weak" : "strong" } }
          : n
      ),
    });
  },

  toggleEntityAssociative: (entityId) => {
    set({
      nodes: get().nodes.map((n) =>
        isEntityNode(n) && n.id === entityId
          ? { ...n, data: { ...n.data, isAssociative: !n.data.isAssociative } }
          : n
      ),
    });
  },

  linkForeignKey: (entityId, attributeId, target) => {
    set({
      nodes: get().nodes.map((n) =>
        isEntityNode(n) && n.id === entityId
          ? {
              ...n,
              data: {
                ...n.data,
                attributes: n.data.attributes.map((a) =>
                  a.id === attributeId
                    ? {
                        ...a,
                        isForeignKey: target !== null,
                        references: target ?? undefined,
                      }
                    : a
                ),
              },
            }
          : n
      ),
    });
  },

  addIndex: (entityId) => {
    set({
      nodes: get().nodes.map((n) =>
        isEntityNode(n) && n.id === entityId
          ? {
              ...n,
              data: {
                ...n.data,
                indexes: [
                  ...n.data.indexes,
                  { id: uuid(), name: `idx_${n.data.name}_${n.data.indexes.length + 1}`, attributeIds: [], isUnique: false },
                ],
              },
            }
          : n
      ),
    });
  },

  updateIndex: (entityId, indexId, patch) => {
    set({
      nodes: get().nodes.map((n) =>
        isEntityNode(n) && n.id === entityId
          ? {
              ...n,
              data: {
                ...n.data,
                indexes: n.data.indexes.map((idx) =>
                  idx.id === indexId ? { ...idx, ...patch } : idx
                ),
              },
            }
          : n
      ),
    });
  },

  removeIndex: (entityId, indexId) => {
    set({
      nodes: get().nodes.map((n) =>
        isEntityNode(n) && n.id === entityId
          ? { ...n, data: { ...n.data, indexes: n.data.indexes.filter((idx) => idx.id !== indexId) } }
          : n
      ),
    });
  },

  toggleIndexAttribute: (entityId, indexId, attributeId) => {
    set({
      nodes: get().nodes.map((n) =>
        isEntityNode(n) && n.id === entityId
          ? {
              ...n,
              data: {
                ...n.data,
                indexes: n.data.indexes.map((idx) =>
                  idx.id === indexId
                    ? {
                        ...idx,
                        attributeIds: idx.attributeIds.includes(attributeId)
                          ? idx.attributeIds.filter((id) => id !== attributeId)
                          : [...idx.attributeIds, attributeId],
                      }
                    : idx
                ),
              },
            }
          : n
      ),
    });
  },

  addRelationshipDiamond: (position) => {
    set({ nodes: [...get().nodes, newRelationshipDiamond(position)] });
  },

  renameRelationshipDiamond: (nodeId, name) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === nodeId && n.type === "relationshipDiamond"
          ? { ...n, data: { ...(n.data as RelationshipDiamondData), name } }
          : n
      ),
    });
  },

  toggleDiamondIdentifying: (nodeId) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === nodeId && n.type === "relationshipDiamond"
          ? {
              ...n,
              data: {
                ...(n.data as RelationshipDiamondData),
                isIdentifying: !(n.data as RelationshipDiamondData).isIdentifying,
              },
            }
          : n
      ),
    });
  },

  toggleDiamondAssociative: (nodeId) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === nodeId && n.type === "relationshipDiamond"
          ? {
              ...n,
              data: {
                ...(n.data as RelationshipDiamondData),
                isAssociative: !(n.data as RelationshipDiamondData).isAssociative,
              },
            }
          : n
      ),
    });
  },

  updateDirectRelationship: (edgeId, patch) => {
    set({
      edges: get().edges.map((e) =>
        e.id === edgeId ? { ...e, data: { ...(e.data as DirectRelationshipData), ...patch } } : e
      ),
    });
  },

  updateCardinalityLink: (edgeId, patch) => {
    set({
      edges: get().edges.map((e) =>
        e.id === edgeId ? { ...e, data: { ...(e.data as CardinalityLinkData), ...patch } } : e
      ),
    });
  },

  exportDiagram: () => {
    const { nodes, edges } = get();
    return JSON.stringify({ nodes, edges }, null, 2);
  },

  importDiagram: (json) => {
    const parsed = JSON.parse(json);
    set({ nodes: parsed.nodes ?? [], edges: parsed.edges ?? [] });
  },

  reset: () => set({ nodes: [], edges: [] }),
}));
