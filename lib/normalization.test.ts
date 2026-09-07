import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import type { Attribute, EntityData } from "@/types/diagram";
import { getNormalizationReport } from "./normalization";

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

function node(id: string, name: string, attributes: Attribute[]): Node<EntityData> {
  return {
    id,
    type: "entity",
    position: { x: 0, y: 0 },
    data: { name, kind: "strong", isAssociative: false, attributes, indexes: [] },
  };
}

describe("getNormalizationReport", () => {
  it("flags a multivalued attribute as a real 1NF violation", () => {
    const n = node("e1", "clientes", [
      attr({ id: "a1", name: "id", isPrimaryKey: true }),
      attr({ id: "a2", name: "telefono", isMultivalued: true }),
    ]);
    const report = getNormalizationReport(n, [n]);
    const issue = report.find((i) => i.form === "1NF" && i.attributeId === "a2");
    expect(issue?.severity).toBe("violation");
  });

  it("flags a composite attribute with no children as a 1NF violation", () => {
    const n = node("e1", "clientes", [
      attr({ id: "a1", name: "id", isPrimaryKey: true }),
      attr({ id: "a2", name: "direccion", isComposite: true }),
    ]);
    const report = getNormalizationReport(n, [n]);
    expect(report.some((i) => i.form === "1NF" && i.attributeId === "a2")).toBe(true);
  });

  it("does not flag 2NF when the PK is not composite", () => {
    const n = node("e1", "clientes", [
      attr({ id: "a1", name: "id", isPrimaryKey: true }),
      attr({ id: "a2", name: "email" }),
    ]);
    const report = getNormalizationReport(n, [n]);
    expect(report.some((i) => i.form === "2NF")).toBe(false);
  });

  it("raises a 2NF heuristic when there's a composite PK with non-key attributes", () => {
    const n = node("e1", "inscripciones", [
      attr({ id: "a1", name: "alumno_id", isPrimaryKey: true }),
      attr({ id: "a2", name: "curso_id", isPrimaryKey: true }),
      attr({ id: "a3", name: "nota", type: "decimal" }),
    ]);
    const report = getNormalizationReport(n, [n]);
    const issue = report.find((i) => i.form === "2NF");
    expect(issue?.severity).toBe("heuristic");
  });

  it("raises a 3NF heuristic when a duplicated column name exists in the referenced entity", () => {
    const ciudades = node("e-ciudad", "ciudades", [
      attr({ id: "c1", name: "id", isPrimaryKey: true }),
      attr({ id: "c2", name: "nombre", type: "varchar" }),
    ]);
    const clientes = node("e-cliente", "clientes", [
      attr({ id: "a1", name: "id", isPrimaryKey: true }),
      attr({
        id: "a2",
        name: "ciudad_id",
        isForeignKey: true,
        references: { entityId: "e-ciudad", attributeId: "c1" },
      }),
      attr({ id: "a3", name: "nombre", type: "varchar" }), // duplica "nombre" de ciudades
    ]);
    const report = getNormalizationReport(clientes, [ciudades, clientes]);
    expect(report.some((i) => i.form === "3NF" && i.attributeId === "a3")).toBe(true);
  });

  it("raises a 4NF heuristic when there are 2+ independent multivalued attributes", () => {
    const n = node("e1", "empleados", [
      attr({ id: "a1", name: "id", isPrimaryKey: true }),
      attr({ id: "a2", name: "telefono", isMultivalued: true }),
      attr({ id: "a3", name: "idioma", isMultivalued: true }),
    ]);
    const report = getNormalizationReport(n, [n]);
    expect(report.some((i) => i.form === "4NF")).toBe(true);
  });

  it("returns no issues for a clean, fully normalized entity", () => {
    const n = node("e1", "productos", [
      attr({ id: "a1", name: "id", isPrimaryKey: true }),
      attr({ id: "a2", name: "nombre", type: "varchar" }),
      attr({ id: "a3", name: "precio", type: "decimal" }),
    ]);
    const report = getNormalizationReport(n, [n]);
    expect(report).toHaveLength(0);
  });
});
