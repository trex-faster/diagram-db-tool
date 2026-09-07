import { describe, expect, it } from "vitest";
import type { Attribute, EntityData } from "@/types/diagram";
import { classifyKeys } from "./keys";

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

function entity(attributes: Attribute[], indexes: EntityData["indexes"] = []): EntityData {
  return { name: "clientes", kind: "strong", isAssociative: false, attributes, indexes };
}

describe("classifyKeys", () => {
  it("identifies a simple (non-composite) primary key", () => {
    const e = entity([attr({ id: "a1", name: "id", isPrimaryKey: true })]);
    const report = classifyKeys(e);
    expect(report.primaryKey.map((a) => a.id)).toEqual(["a1"]);
    expect(report.isCompositePK).toBe(false);
  });

  it("identifies a composite primary key", () => {
    const e = entity([
      attr({ id: "a1", name: "alumno_id", isPrimaryKey: true }),
      attr({ id: "a2", name: "curso_id", isPrimaryKey: true }),
    ]);
    expect(classifyKeys(e).isCompositePK).toBe(true);
  });

  it("finds a single-attribute candidate key (UNIQUE + NOT NULL, not the PK)", () => {
    const e = entity([
      attr({ id: "a1", name: "id", isPrimaryKey: true }),
      attr({ id: "a2", name: "email", type: "varchar", isUnique: true }),
    ]);
    const report = classifyKeys(e);
    expect(report.candidateKeys).toEqual([{ attributeIds: ["a2"], label: "email" }]);
  });

  it("does not count a nullable UNIQUE attribute as a candidate key", () => {
    const e = entity([
      attr({ id: "a1", name: "id", isPrimaryKey: true }),
      attr({ id: "a2", name: "apodo", type: "varchar", isUnique: true, nullable: true }),
    ]);
    expect(classifyKeys(e).candidateKeys).toHaveLength(0);
  });

  it("finds a composite candidate key from a UNIQUE index that isn't the PK", () => {
    const e = entity(
      [
        attr({ id: "a1", name: "id", isPrimaryKey: true }),
        attr({ id: "a2", name: "tenant_id" }),
        attr({ id: "a3", name: "slug", type: "varchar" }),
      ],
      [{ id: "i1", name: "uq_tenant_slug", attributeIds: ["a2", "a3"], isUnique: true }]
    );
    const report = classifyKeys(e);
    expect(report.candidateKeys.some((c) => c.label === "tenant_id + slug")).toBe(true);
  });

  it("does not treat a UNIQUE index identical to the PK as a candidate key", () => {
    const e = entity(
      [
        attr({ id: "a1", name: "alumno_id", isPrimaryKey: true }),
        attr({ id: "a2", name: "curso_id", isPrimaryKey: true }),
      ],
      [{ id: "i1", name: "pk_index", attributeIds: ["a1", "a2"], isUnique: true }]
    );
    expect(classifyKeys(e).candidateKeys).toHaveLength(0);
  });

  it("lists partial keys (weak entity discriminators) separately", () => {
    const e = entity([
      attr({ id: "a1", name: "factura_id", isPrimaryKey: true }),
      attr({ id: "a2", name: "numero_linea", isPartialKey: true }),
    ]);
    expect(classifyKeys(e).partialKeys.map((a) => a.id)).toEqual(["a2"]);
  });
});
