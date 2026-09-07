import { describe, expect, it } from "vitest";
import type { Attribute, EntityData } from "@/types/diagram";
import { getEntityWarnings } from "./validation";

function attr(overrides: Partial<Attribute> & Pick<Attribute, "id" | "name">): Attribute {
  return {
    type: "integer",
    nullable: false,
    isPrimaryKey: false,
    isForeignKey: false,
    isPartialKey: false,
    isUnique: false,
    isMultivalued: false,
    isDerived: false,
    isComposite: false,
    ...overrides,
  };
}

function entity(name: string, attributes: Attribute[], indexes: EntityData["indexes"] = []): EntityData {
  return { name, kind: "strong", isAssociative: false, attributes, indexes };
}

describe("getEntityWarnings", () => {
  it("flags an entity with no primary key", () => {
    const e = entity("clientes", [attr({ id: "a1", name: "nombre", type: "varchar" })]);
    const warnings = getEntityWarnings(e);
    expect(warnings.some((w) => w.message.includes("Primary Key"))).toBe(true);
  });

  it("flags a bad table name (camelCase) with a naming warning", () => {
    const e = entity("clienteTabla", [attr({ id: "a1", name: "id", isPrimaryKey: true })]);
    const warnings = getEntityWarnings(e);
    expect(warnings.some((w) => w.message.includes("clienteTabla"))).toBe(true);
  });

  it("flags an FK marked without a target", () => {
    const e = entity("pedidos", [
      attr({ id: "a1", name: "id", isPrimaryKey: true }),
      attr({ id: "a2", name: "cliente_id", isForeignKey: true }),
    ]);
    const warnings = getEntityWarnings(e);
    expect(warnings.some((w) => w.attributeId === "a2" && w.message.includes("no apunta"))).toBe(true);
  });

  it("flags a real FK that has no index (best-practice check)", () => {
    const e = entity("pedidos", [
      attr({ id: "a1", name: "id", isPrimaryKey: true }),
      attr({
        id: "a2",
        name: "cliente_id",
        isForeignKey: true,
        references: { entityId: "e-clientes", attributeId: "pk" },
      }),
    ]);
    const warnings = getEntityWarnings(e);
    expect(warnings.some((w) => w.attributeId === "a2" && w.message.includes("índice"))).toBe(true);
  });

  it("does NOT flag an FK that already has an index covering it", () => {
    const e = entity(
      "pedidos",
      [
        attr({ id: "a1", name: "id", isPrimaryKey: true }),
        attr({
          id: "a2",
          name: "cliente_id",
          isForeignKey: true,
          references: { entityId: "e-clientes", attributeId: "pk" },
        }),
      ],
      [{ id: "i1", name: "idx_pedidos_cliente_id", attributeIds: ["a2"], isUnique: false }]
    );
    const warnings = getEntityWarnings(e);
    expect(warnings.some((w) => w.attributeId === "a2" && w.message.includes("índice"))).toBe(false);
  });

  it("flags duplicate attribute names", () => {
    const e = entity("clientes", [
      attr({ id: "a1", name: "id", isPrimaryKey: true }),
      attr({ id: "a2", name: "email" }),
      attr({ id: "a3", name: "email" }),
    ]);
    const warnings = getEntityWarnings(e);
    expect(warnings.some((w) => w.message.includes("repetidos"))).toBe(true);
  });
});
