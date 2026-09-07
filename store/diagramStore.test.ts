import { beforeEach, describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import type { EntityData } from "@/types/diagram";
import { useDiagramStore } from "./diagramStore";

function resetStore() {
  useDiagramStore.getState().newDiagram();
}

function asEntity(node: unknown): Node<EntityData> {
  return node as Node<EntityData>;
}

describe("deleteNode — cascade delete", () => {
  beforeEach(resetStore);

  it("removes the node itself", () => {
    const { addEntity } = useDiagramStore.getState();
    addEntity({ x: 0, y: 0 });
    const entityId = useDiagramStore.getState().nodes[0].id;

    useDiagramStore.getState().deleteNode(entityId);

    expect(useDiagramStore.getState().nodes).toHaveLength(0);
  });

  it("removes edges connected to the deleted node", () => {
    const { addEntity } = useDiagramStore.getState();
    addEntity({ x: 0, y: 0 });
    addEntity({ x: 200, y: 0 });
    const [a, b] = useDiagramStore.getState().nodes;

    useDiagramStore.getState().onConnect({ source: a.id, target: b.id, sourceHandle: null, targetHandle: null });
    expect(useDiagramStore.getState().edges).toHaveLength(1);

    useDiagramStore.getState().deleteNode(a.id);

    expect(useDiagramStore.getState().edges).toHaveLength(0);
    expect(useDiagramStore.getState().nodes).toHaveLength(1);
  });

  it("cascades: deletes the FK column in another entity that referenced the deleted one", () => {
    const { addEntity, linkForeignKey } = useDiagramStore.getState();
    addEntity({ x: 0, y: 0 }); // "clientes" (será el referenciado)
    addEntity({ x: 200, y: 0 }); // "pedidos" (tendrá la FK)
    const [clientesRaw, pedidosRaw] = useDiagramStore.getState().nodes;
    const clientes = asEntity(clientesRaw);
    const pedidos = asEntity(pedidosRaw);
    const clientePk = clientes.data.attributes[0]; // "id", ya viene como PK por defecto

    // Le agrego un atributo FK manual a "pedidos" apuntando a "clientes".
    useDiagramStore.getState().addAttribute(pedidos.id);
    const pedidosNode = asEntity(useDiagramStore.getState().nodes.find((n) => n.id === pedidos.id)!);
    const newAttr = pedidosNode.data.attributes[pedidosNode.data.attributes.length - 1];
    linkForeignKey(pedidos.id, newAttr.id, { entityId: clientes.id, attributeId: clientePk.id });

    // Confirmamos que quedó vinculada + indexada antes de borrar.
    const beforeDelete = asEntity(useDiagramStore.getState().nodes.find((n) => n.id === pedidos.id)!);
    expect(beforeDelete.data.attributes.some((a) => a.id === newAttr.id && a.isForeignKey)).toBe(true);
    expect(beforeDelete.data.indexes.some((idx) => idx.attributeIds.includes(newAttr.id))).toBe(true);

    // Borro "clientes" — la FK en "pedidos" debe desaparecer junto con su índice.
    useDiagramStore.getState().deleteNode(clientes.id);

    const afterDelete = asEntity(useDiagramStore.getState().nodes.find((n) => n.id === pedidos.id)!);
    expect(afterDelete.data.attributes.some((a) => a.id === newAttr.id)).toBe(false);
    expect(afterDelete.data.indexes.some((idx) => idx.attributeIds.includes(newAttr.id))).toBe(false);
    expect(useDiagramStore.getState().nodes.some((n) => n.id === clientes.id)).toBe(false);
  });

  it("is undoable via the history stack", () => {
    const { addEntity, undo } = useDiagramStore.getState();
    addEntity({ x: 0, y: 0 });
    const entityId = useDiagramStore.getState().nodes[0].id;

    useDiagramStore.getState().deleteNode(entityId);
    expect(useDiagramStore.getState().nodes).toHaveLength(0);

    undo();
    expect(useDiagramStore.getState().nodes).toHaveLength(1);
    expect(useDiagramStore.getState().nodes[0].id).toBe(entityId);
  });
});
