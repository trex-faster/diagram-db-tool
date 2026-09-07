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
  IsaLinkData,
  RelationshipDiamondData,
  SpecializationData,
} from "@/types/diagram";
import { isManyCardinality } from "@/types/diagram";
import { singularize, toSnakeCase } from "@/lib/naming";

// crypto.randomUUID() está disponible nativamente en navegadores modernos y en Node 19+,
// así evitamos la dependencia extra de "uuid".
const uuid = () => crypto.randomUUID();

type AnyNodeData = EntityData | RelationshipDiamondData | SpecializationData;
type AnyEdgeData = DirectRelationshipData | CardinalityLinkData | IsaLinkData;

interface Snapshot {
  nodes: Node<AnyNodeData>[];
  edges: Edge<AnyEdgeData>[];
}

const MAX_HISTORY = 50;

interface DiagramState {
  nodes: Node<AnyNodeData>[];
  edges: Edge<AnyEdgeData>[];

  // Metadata para autoguardado / lista de diagramas.
  diagramId: string;
  diagramName: string;
  setDiagramMeta: (id: string, name: string) => void;
  renameDiagram: (name: string) => void;

  // Undo/redo — historial de snapshots estructurales (no se registra en cada
  // movimiento de mouse durante un drag, solo en ediciones "con sentido").
  history: { past: Snapshot[]; future: Snapshot[] };
  undo: () => void;
  redo: () => void;

  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: Connection) => void;

  // Entidades
  addEntity: (position: { x: number; y: number }) => void;
  addAttribute: (entityId: string, parentAttributeId?: string) => void;
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

  // Buenas prácticas automatizadas
  /** Genera la columna FK real en el lado "muchos" de una relación directa 1:N, con su índice. */
  materializeForeignKey: (edgeId: string) => void;
  /** Genera la tabla intermedia (con sus 2 FKs indexadas) para una relación directa M:N. */
  materializeJunctionTable: (edgeId: string) => void;
  /** Agrega el par polimórfico {base}_id + {base}_type (patrón Rails/Laravel) a una entidad. */
  addPolymorphicPair: (entityId: string, baseName: string) => void;

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

  // Especialización / Generalización (jerarquías ISA)
  addSpecialization: (position: { x: number; y: number }) => void;
  toggleSpecializationConstraint: (nodeId: string) => void;
  toggleSpecializationCompleteness: (nodeId: string) => void;
  updateSpecializationDiscriminator: (nodeId: string, discriminator: string) => void;

  // Edges
  updateDirectRelationship: (edgeId: string, patch: Partial<DirectRelationshipData>) => void;
  updateCardinalityLink: (edgeId: string, patch: Partial<CardinalityLinkData>) => void;

  /**
   * Borrado en cascada real: elimina el nodo, TODOS los edges conectados a él (relaciones
   * directas, links de cardinalidad, links ISA), y — si es una entidad — recorre el resto
   * de las entidades y borra cualquier columna FK que apuntara a ella (references.entityId
   * === nodeId), limpiando también los índices que la incluían. Nada queda "huérfano".
   */
  deleteNode: (nodeId: string) => void;

  exportDiagram: () => string;
  importDiagram: (json: string) => void;
  loadSnapshot: (snapshot: Snapshot, meta?: { id: string; name: string }) => void;
  reset: () => void;
  newDiagram: () => void;
}

function defaultAttribute(name: string, isPrimaryKey = false, parentAttributeId?: string): Attribute {
  return {
    id: uuid(),
    name,
    type: "integer",
    nullable: false,
    isPrimaryKey,
    isForeignKey: false,
    isPartialKey: false,
    isUnique: false,
    isMultivalued: false,
    isDerived: false,
    isComposite: false,
    parentAttributeId,
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

function newSpecializationNode(position: { x: number; y: number }): Node<SpecializationData> {
  return {
    id: uuid(),
    type: "specialization",
    position,
    data: {
      constraint: "disjoint",
      completeness: "partial",
      discriminator: "",
    },
  };
}

function isEntityNode(node: Node<AnyNodeData> | undefined): node is Node<EntityData> {
  return node?.type === "entity";
}

function isSpecializationNode(node: Node<AnyNodeData> | undefined): node is Node<SpecializationData> {
  return node?.type === "specialization";
}

function cloneSnapshot(nodes: Node<AnyNodeData>[], edges: Edge<AnyEdgeData>[]): Snapshot {
  // structuredClone evita que el historial comparta referencias con el estado actual.
  return { nodes: structuredClone(nodes), edges: structuredClone(edges) };
}

export const useDiagramStore = create<DiagramState>((set, get) => {
  /**
   * Toda mutación "con sentido" (agregar entidad, renombrar, borrar atributo, etc.)
   * pasa por acá: primero empuja el estado actual al historial, después aplica el
   * cambio. onNodesChange/onEdgesChange (drags, selección) NO pasan por acá a propósito
   * — si no, cada pixel de arrastre generaría un paso de undo.
   */
  function mutate(partial: Partial<Pick<DiagramState, "nodes" | "edges">>) {
    const { nodes, edges, history } = get();
    const past = [...history.past, cloneSnapshot(nodes, edges)].slice(-MAX_HISTORY);
    set({ ...partial, history: { past, future: [] } });
  }

  return {
    nodes: [],
    edges: [],

    diagramId: uuid(),
    diagramName: "Diagrama sin título",
    setDiagramMeta: (id, name) => set({ diagramId: id, diagramName: name }),
    renameDiagram: (name) => set({ diagramName: name }),

    history: { past: [], future: [] },

    undo: () => {
      const { nodes, edges, history } = get();
      if (history.past.length === 0) return;
      const previous = history.past[history.past.length - 1];
      const past = history.past.slice(0, -1);
      const future = [cloneSnapshot(nodes, edges), ...history.future].slice(0, MAX_HISTORY);
      set({ nodes: previous.nodes, edges: previous.edges, history: { past, future } });
    },

    redo: () => {
      const { nodes, edges, history } = get();
      if (history.future.length === 0) return;
      const next = history.future[0];
      const future = history.future.slice(1);
      const past = [...history.past, cloneSnapshot(nodes, edges)].slice(-MAX_HISTORY);
      set({ nodes: next.nodes, edges: next.edges, history: { past, future } });
    },

    onNodesChange: (changes) => {
      set({ nodes: applyNodeChanges(changes, get().nodes) as Node<AnyNodeData>[] });
    },

    onEdgesChange: (changes) => {
      set({ edges: applyEdgeChanges(changes, get().edges) as Edge<AnyEdgeData>[] });
    },

    onConnect: (connection) => {
      const { nodes, edges } = get();
      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);

      const bothEntities = sourceNode?.type === "entity" && targetNode?.type === "entity";
      const involvesDiamond =
        sourceNode?.type === "relationshipDiamond" || targetNode?.type === "relationshipDiamond";
      const involvesSpecialization =
        sourceNode?.type === "specialization" || targetNode?.type === "specialization";

      if (bothEntities) {
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
        mutate({ edges: addEdge(newEdge, edges) as Edge<AnyEdgeData>[] });
        return;
      }

      if (involvesSpecialization) {
        const newEdge: Edge<IsaLinkData> = {
          id: uuid(),
          source: connection.source!,
          target: connection.target!,
          type: "isaLink",
          data: {},
        };
        mutate({ edges: addEdge(newEdge, edges) as Edge<AnyEdgeData>[] });
        return;
      }

      if (involvesDiamond) {
        const newEdge: Edge<CardinalityLinkData> = {
          id: uuid(),
          source: connection.source!,
          target: connection.target!,
          type: "cardinalityLink",
          data: { cardinality: "N", participation: "partial" },
        };
        mutate({ edges: addEdge(newEdge, edges) as Edge<AnyEdgeData>[] });
        return;
      }
    },

    addEntity: (position) => {
      mutate({ nodes: [...get().nodes, newEntityNode(position)] });
    },

    addAttribute: (entityId, parentAttributeId) => {
      mutate({
        nodes: get().nodes.map((n) =>
          isEntityNode(n) && n.id === entityId
            ? {
                ...n,
                data: {
                  ...n.data,
                  attributes: [
                    ...n.data.attributes,
                    defaultAttribute(
                      parentAttributeId ? "sub_atributo" : "nuevo_campo",
                      false,
                      parentAttributeId
                    ),
                  ],
                },
              }
            : n
        ),
      });
    },

    updateAttribute: (entityId, attributeId, patch) => {
      mutate({
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
      mutate({
        nodes: get().nodes.map((n) =>
          isEntityNode(n) && n.id === entityId
            ? {
                ...n,
                data: {
                  ...n.data,
                  attributes: n.data.attributes.filter(
                    (a) => a.id !== attributeId && a.parentAttributeId !== attributeId
                  ),
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
      mutate({
        nodes: get().nodes.map((n) =>
          isEntityNode(n) && n.id === entityId ? { ...n, data: { ...n.data, name } } : n
        ),
      });
    },

    toggleEntityKind: (entityId) => {
      mutate({
        nodes: get().nodes.map((n) =>
          isEntityNode(n) && n.id === entityId
            ? { ...n, data: { ...n.data, kind: n.data.kind === "strong" ? "weak" : "strong" } }
            : n
        ),
      });
    },

    toggleEntityAssociative: (entityId) => {
      mutate({
        nodes: get().nodes.map((n) =>
          isEntityNode(n) && n.id === entityId
            ? { ...n, data: { ...n.data, isAssociative: !n.data.isAssociative } }
            : n
        ),
      });
    },

    linkForeignKey: (entityId, attributeId, target) => {
      mutate({
        nodes: get().nodes.map((n) => {
          if (!isEntityNode(n) || n.id !== entityId) return n;
          const updatedAttributes = n.data.attributes.map((a) =>
            a.id === attributeId
              ? { ...a, isForeignKey: target !== null, references: target ?? undefined }
              : a
          );
          // Buena práctica: toda FK debe estar indexada (evita full table scans en los
          // JOINs). Si ya existe un índice que cubra exactamente esta columna, no duplicamos.
          const alreadyIndexed = n.data.indexes.some(
            (idx) => idx.attributeIds.length === 1 && idx.attributeIds[0] === attributeId
          );
          const attrName = n.data.attributes.find((a) => a.id === attributeId)?.name ?? "fk";
          const indexes =
            target !== null && !alreadyIndexed
              ? [
                  ...n.data.indexes,
                  { id: uuid(), name: `idx_${n.data.name}_${attrName}`, attributeIds: [attributeId], isUnique: false },
                ]
              : n.data.indexes;
          return { ...n, data: { ...n.data, attributes: updatedAttributes, indexes } };
        }),
      });
    },

    materializeForeignKey: (edgeId) => {
      const { edges, nodes } = get();
      const edge = edges.find((e) => e.id === edgeId);
      if (!edge || edge.type !== "direct") return;
      const data = edge.data as DirectRelationshipData;
      if (data.materializedFk) return; // ya generada, no duplicar

      const sourceEntity = nodes.find((n) => n.id === edge.source);
      const targetEntity = nodes.find((n) => n.id === edge.target);
      if (!isEntityNode(sourceEntity) || !isEntityNode(targetEntity)) return;

      const sourceMany = isManyCardinality(data.sourceCardinality);
      const targetMany = isManyCardinality(data.targetCardinality);

      let oneEntity: Node<EntityData>;
      let manyEntity: Node<EntityData>;
      if (!sourceMany && targetMany) {
        oneEntity = sourceEntity;
        manyEntity = targetEntity;
      } else if (sourceMany && !targetMany) {
        oneEntity = targetEntity;
        manyEntity = sourceEntity;
      } else {
        return; // M:N (usar materializeJunctionTable) o 1:1 (ambiguo, se vincula a mano)
      }

      const onePk = oneEntity.data.attributes.find((a) => a.isPrimaryKey);
      if (!onePk) return; // sin PK en el lado "1" no hay a qué apuntar

      const fkName = toSnakeCase(`${singularize(oneEntity.data.name)}_${onePk.name}`);
      const newAttr: Attribute = {
        id: uuid(),
        name: fkName,
        type: onePk.type,
        length: onePk.length,
        precision: onePk.precision,
        scale: onePk.scale,
        nullable: false,
        isPrimaryKey: false,
        isForeignKey: true,
        isPartialKey: false,
        isUnique: false,
        isMultivalued: false,
        isDerived: false,
        isComposite: false,
        references: { entityId: oneEntity.id, attributeId: onePk.id },
      };

      mutate({
        nodes: nodes.map((n) =>
          n.id === manyEntity.id && isEntityNode(n)
            ? {
                ...n,
                data: {
                  ...n.data,
                  attributes: [...n.data.attributes, newAttr],
                  // Índice automático en la FK recién creada (buena práctica).
                  indexes: [
                    ...n.data.indexes,
                    { id: uuid(), name: `idx_${n.data.name}_${fkName}`, attributeIds: [newAttr.id], isUnique: false },
                  ],
                },
              }
            : n
        ),
        edges: edges.map((e) =>
          e.id === edgeId
            ? { ...e, data: { ...data, materializedFk: { entityId: manyEntity.id, attributeId: newAttr.id } } }
            : e
        ),
      });
    },

    materializeJunctionTable: (edgeId) => {
      const { edges, nodes } = get();
      const edge = edges.find((e) => e.id === edgeId);
      if (!edge || edge.type !== "direct") return;
      const data = edge.data as DirectRelationshipData;
      if (data.materializedJunctionEntityId) return;

      const sourceEntity = nodes.find((n) => n.id === edge.source);
      const targetEntity = nodes.find((n) => n.id === edge.target);
      if (!isEntityNode(sourceEntity) || !isEntityNode(targetEntity)) return;

      const bothMany = isManyCardinality(data.sourceCardinality) && isManyCardinality(data.targetCardinality);
      if (!bothMany) return; // no es M:N

      const sourcePk = sourceEntity.data.attributes.find((a) => a.isPrimaryKey);
      const targetPk = targetEntity.data.attributes.find((a) => a.isPrimaryKey);
      if (!sourcePk || !targetPk) return;

      const fkA: Attribute = {
        id: uuid(),
        name: toSnakeCase(`${singularize(sourceEntity.data.name)}_${sourcePk.name}`),
        type: sourcePk.type,
        length: sourcePk.length,
        nullable: false,
        isPrimaryKey: true, // PK compuesta: buena práctica en tablas puramente de unión
        isForeignKey: true,
        isPartialKey: false,
        isUnique: false,
        isMultivalued: false,
        isDerived: false,
        isComposite: false,
        references: { entityId: sourceEntity.id, attributeId: sourcePk.id },
      };
      const fkB: Attribute = {
        id: uuid(),
        name: toSnakeCase(`${singularize(targetEntity.data.name)}_${targetPk.name}`),
        type: targetPk.type,
        length: targetPk.length,
        nullable: false,
        isPrimaryKey: true,
        isForeignKey: true,
        isPartialKey: false,
        isUnique: false,
        isMultivalued: false,
        isDerived: false,
        isComposite: false,
        references: { entityId: targetEntity.id, attributeId: targetPk.id },
      };

      const junctionName = toSnakeCase(`${singularize(sourceEntity.data.name)}_${singularize(targetEntity.data.name)}`);
      const junctionNode: Node<EntityData> = {
        id: uuid(),
        type: "entity",
        position: {
          x: (sourceEntity.position.x + targetEntity.position.x) / 2,
          y: (sourceEntity.position.y + targetEntity.position.y) / 2 + 150,
        },
        data: {
          name: junctionName,
          kind: "strong",
          isAssociative: true,
          attributes: [fkA, fkB],
          indexes: [
            // La PK compuesta ya cubre (fkA, fkB); agregamos también fkB sola para que las
            // búsquedas "por el otro lado" (JOIN inverso) no escaneen la tabla entera.
            { id: uuid(), name: `idx_${junctionName}_${fkB.name}`, attributeIds: [fkB.id], isUnique: false },
          ],
        },
      };

      mutate({
        nodes: [...nodes, junctionNode as Node<AnyNodeData>],
        edges: edges.map((e) =>
          e.id === edgeId ? { ...e, data: { ...data, materializedJunctionEntityId: junctionNode.id } } : e
        ),
      });
    },

    addPolymorphicPair: (entityId, baseName) => {
      const clean = toSnakeCase(baseName) || "polymorphic";
      const group = `${clean}_${uuid().slice(0, 4)}`;
      const idAttr: Attribute = {
        id: uuid(),
        name: `${clean}_id`,
        type: "integer",
        nullable: false,
        isPrimaryKey: false,
        isForeignKey: false, // por diseño no apunta a UNA sola tabla — no es un FK real de la base
        isPartialKey: false,
        isUnique: false,
        isMultivalued: false,
        isDerived: false,
        isComposite: false,
        polymorphicGroup: group,
        polymorphicRole: "id",
      };
      const typeAttr: Attribute = {
        id: uuid(),
        name: `${clean}_type`,
        type: "varchar",
        length: 255,
        nullable: false,
        isPrimaryKey: false,
        isForeignKey: false,
        isPartialKey: false,
        isUnique: false,
        isMultivalued: false,
        isDerived: false,
        isComposite: false,
        polymorphicGroup: group,
        polymorphicRole: "type",
      };

      mutate({
        nodes: get().nodes.map((n) =>
          isEntityNode(n) && n.id === entityId
            ? {
                ...n,
                data: {
                  ...n.data,
                  attributes: [...n.data.attributes, idAttr, typeAttr],
                  // Índice compuesto (id, type) — el patrón estándar para lookups polimórficos.
                  indexes: [
                    ...n.data.indexes,
                    {
                      id: uuid(),
                      name: `idx_${n.data.name}_${clean}`,
                      attributeIds: [idAttr.id, typeAttr.id],
                      isUnique: false,
                    },
                  ],
                },
              }
            : n
        ),
      });
    },

    addIndex: (entityId) => {
      mutate({
        nodes: get().nodes.map((n) =>
          isEntityNode(n) && n.id === entityId
            ? {
                ...n,
                data: {
                  ...n.data,
                  indexes: [
                    ...n.data.indexes,
                    {
                      id: uuid(),
                      name: `idx_${n.data.name}_${n.data.indexes.length + 1}`,
                      attributeIds: [],
                      isUnique: false,
                    },
                  ],
                },
              }
            : n
        ),
      });
    },

    updateIndex: (entityId, indexId, patch) => {
      mutate({
        nodes: get().nodes.map((n) =>
          isEntityNode(n) && n.id === entityId
            ? {
                ...n,
                data: {
                  ...n.data,
                  indexes: n.data.indexes.map((idx) => (idx.id === indexId ? { ...idx, ...patch } : idx)),
                },
              }
            : n
        ),
      });
    },

    removeIndex: (entityId, indexId) => {
      mutate({
        nodes: get().nodes.map((n) =>
          isEntityNode(n) && n.id === entityId
            ? { ...n, data: { ...n.data, indexes: n.data.indexes.filter((idx) => idx.id !== indexId) } }
            : n
        ),
      });
    },

    toggleIndexAttribute: (entityId, indexId, attributeId) => {
      mutate({
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
      mutate({ nodes: [...get().nodes, newRelationshipDiamond(position)] });
    },

    renameRelationshipDiamond: (nodeId, name) => {
      mutate({
        nodes: get().nodes.map((n) =>
          n.id === nodeId && n.type === "relationshipDiamond"
            ? { ...n, data: { ...(n.data as RelationshipDiamondData), name } }
            : n
        ),
      });
    },

    toggleDiamondIdentifying: (nodeId) => {
      mutate({
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
      mutate({
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

    addSpecialization: (position) => {
      mutate({ nodes: [...get().nodes, newSpecializationNode(position)] });
    },

    toggleSpecializationConstraint: (nodeId) => {
      mutate({
        nodes: get().nodes.map((n) =>
          isSpecializationNode(n) && n.id === nodeId
            ? { ...n, data: { ...n.data, constraint: n.data.constraint === "disjoint" ? "overlapping" : "disjoint" } }
            : n
        ),
      });
    },

    toggleSpecializationCompleteness: (nodeId) => {
      mutate({
        nodes: get().nodes.map((n) =>
          isSpecializationNode(n) && n.id === nodeId
            ? { ...n, data: { ...n.data, completeness: n.data.completeness === "total" ? "partial" : "total" } }
            : n
        ),
      });
    },

    updateSpecializationDiscriminator: (nodeId, discriminator) => {
      mutate({
        nodes: get().nodes.map((n) =>
          isSpecializationNode(n) && n.id === nodeId ? { ...n, data: { ...n.data, discriminator } } : n
        ),
      });
    },

    updateDirectRelationship: (edgeId, patch) => {
      mutate({
        edges: get().edges.map((e) =>
          e.id === edgeId ? { ...e, data: { ...(e.data as DirectRelationshipData), ...patch } } : e
        ),
      });
    },

    updateCardinalityLink: (edgeId, patch) => {
      mutate({
        edges: get().edges.map((e) =>
          e.id === edgeId ? { ...e, data: { ...(e.data as CardinalityLinkData), ...patch } } : e
        ),
      });
    },

    deleteNode: (nodeId) => {
      const { nodes, edges } = get();
      const target = nodes.find((n) => n.id === nodeId);
      if (!target) return;

      // 1. Todo edge conectado a este nodo (de cualquier tipo) desaparece con él.
      const remainingEdges = edges.filter((e) => e.source !== nodeId && e.target !== nodeId);

      // 2. Si era una entidad, en CUALQUIER otra entidad borramos las columnas FK que
      //    apuntaban acá — si no, quedarían FKs "huérfanas" apuntando a una tabla que ya no existe.
      let remainingNodes = nodes.filter((n) => n.id !== nodeId);
      if (isEntityNode(target)) {
        remainingNodes = remainingNodes.map((n) => {
          if (!isEntityNode(n)) return n;
          const orphanedIds = new Set(
            n.data.attributes
              .filter((a) => a.isForeignKey && a.references?.entityId === nodeId)
              .map((a) => a.id)
          );
          if (orphanedIds.size === 0) return n;
          return {
            ...n,
            data: {
              ...n.data,
              attributes: n.data.attributes.filter((a) => !orphanedIds.has(a.id)),
              indexes: n.data.indexes
                .map((idx) => ({ ...idx, attributeIds: idx.attributeIds.filter((id) => !orphanedIds.has(id)) }))
                .filter((idx) => idx.attributeIds.length > 0),
            },
          };
        });
      }

      mutate({ nodes: remainingNodes, edges: remainingEdges });
    },

    exportDiagram: () => {
      const { nodes, edges, diagramName } = get();
      return JSON.stringify({ name: diagramName, nodes, edges }, null, 2);
    },

    importDiagram: (json) => {
      // Puede lanzar (JSON inválido, forma inesperada) — el llamador (Toolbar) lo captura
      // y le avisa al usuario en vez de crashear la app entera.
      const parsed = JSON.parse(json);
      if (!parsed || typeof parsed !== "object") {
        throw new Error("El archivo no contiene un diagrama válido (se esperaba un objeto JSON).");
      }
      if (parsed.nodes !== undefined && !Array.isArray(parsed.nodes)) {
        throw new Error('El campo "nodes" del archivo no es una lista válida.');
      }
      if (parsed.edges !== undefined && !Array.isArray(parsed.edges)) {
        throw new Error('El campo "edges" del archivo no es una lista válida.');
      }
      mutate({ nodes: parsed.nodes ?? [], edges: parsed.edges ?? [] });
      if (typeof parsed.name === "string") set({ diagramName: parsed.name });
    },

    loadSnapshot: (snapshot, meta) => {
      // Usado por el autoguardado para cargar un diagrama guardado sin ensuciar el
      // historial de undo con el estado previo (vacío) del canvas.
      set({
        nodes: snapshot.nodes,
        edges: snapshot.edges,
        history: { past: [], future: [] },
        ...(meta ? { diagramId: meta.id, diagramName: meta.name } : {}),
      });
    },

    reset: () => mutate({ nodes: [], edges: [] }),

    newDiagram: () => {
      set({
        nodes: [],
        edges: [],
        history: { past: [], future: [] },
        diagramId: uuid(),
        diagramName: "Diagrama sin título",
      });
    },
  };
});
