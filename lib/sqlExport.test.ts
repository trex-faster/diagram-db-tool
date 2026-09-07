import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import type { Attribute, EntityData, IndexDef } from "@/types/diagram";
import { generateSQL } from "./sqlExport";

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

function entityNode(
  id: string,
  name: string,
  attributes: Attribute[],
  indexes: IndexDef[] = []
): Node<EntityData> {
  return {
    id,
    type: "entity",
    position: { x: 0, y: 0 },
    data: { name, kind: "strong", isAssociative: false, attributes, indexes },
  };
}

describe("generateSQL", () => {
  it("generates a basic CREATE TABLE with a primary key", () => {
    const nodes = [
      entityNode("e1", "usuarios", [
        attr({ id: "a1", name: "id", isPrimaryKey: true }),
        attr({ id: "a2", name: "email", type: "varchar", length: 255 }),
      ]),
    ];
    const sql = generateSQL(nodes, [], "postgres");
    expect(sql).toContain('CREATE TABLE "usuarios"');
    expect(sql).toContain('"id" INTEGER NOT NULL');
    expect(sql).toContain('"email" VARCHAR(255) NOT NULL');
    expect(sql).toContain('PRIMARY KEY ("id")');
  });

  it("generates a real FOREIGN KEY from attribute.references", () => {
    const nodes = [
      entityNode("e1", "clientes", [attr({ id: "a1", name: "id", isPrimaryKey: true })]),
      entityNode("e2", "pedidos", [
        attr({ id: "b1", name: "id", isPrimaryKey: true }),
        attr({
          id: "b2",
          name: "cliente_id",
          isForeignKey: true,
          references: { entityId: "e1", attributeId: "a1" },
        }),
      ]),
    ];
    const sql = generateSQL(nodes, [], "postgres");
    expect(sql).toContain('FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id")');
  });

  it("does NOT generate a FOREIGN KEY line when isForeignKey is true but references is missing", () => {
    const nodes = [
      entityNode("e1", "pedidos", [
        attr({ id: "a1", name: "id", isPrimaryKey: true }),
        attr({ id: "a2", name: "cliente_id", isForeignKey: true }), // sin references
      ]),
    ];
    const sql = generateSQL(nodes, [], "postgres");
    expect(sql).not.toContain("FOREIGN KEY");
  });

  it("flattens composite attributes to their sub-attributes, omitting the parent as a column", () => {
    const nodes = [
      entityNode("e1", "clientes", [
        attr({ id: "a1", name: "id", isPrimaryKey: true }),
        attr({ id: "a2", name: "direccion", isComposite: true }),
        attr({ id: "a3", name: "calle", type: "varchar", parentAttributeId: "a2" }),
        attr({ id: "a4", name: "ciudad", type: "varchar", parentAttributeId: "a2" }),
      ]),
    ];
    const sql = generateSQL(nodes, [], "postgres");
    expect(sql).toContain('"calle"');
    expect(sql).toContain('"ciudad"');
    expect(sql).not.toContain('"direccion"');
  });

  it("omits derived attributes from the generated columns", () => {
    const nodes = [
      entityNode("e1", "personas", [
        attr({ id: "a1", name: "id", isPrimaryKey: true }),
        attr({ id: "a2", name: "fecha_nacimiento", type: "date" }),
        attr({ id: "a3", name: "edad", isDerived: true }),
      ]),
    ];
    const sql = generateSQL(nodes, [], "postgres");
    expect(sql).not.toContain('"edad"');
  });

  it("warns about multivalued attributes instead of silently emitting a broken column", () => {
    const nodes = [
      entityNode("e1", "clientes", [
        attr({ id: "a1", name: "id", isPrimaryKey: true }),
        attr({ id: "a2", name: "telefono", type: "varchar", isMultivalued: true }),
      ]),
    ];
    const sql = generateSQL(nodes, [], "postgres");
    expect(sql).toContain("multivaluado");
    expect(sql).toContain('"telefono"'); // sigue emitiendo la columna, solo avisa
  });

  it("generates CREATE INDEX and CREATE UNIQUE INDEX for defined indexes", () => {
    const nodes = [
      entityNode(
        "e1",
        "usuarios",
        [
          attr({ id: "a1", name: "id", isPrimaryKey: true }),
          attr({ id: "a2", name: "email", type: "varchar" }),
        ],
        [{ id: "i1", name: "idx_email", attributeIds: ["a2"], isUnique: true }]
      ),
    ];
    const sql = generateSQL(nodes, [], "postgres");
    expect(sql).toContain('CREATE UNIQUE INDEX "idx_email" ON "usuarios" ("email");');
  });

  it("skips indexes with no columns selected", () => {
    const nodes = [
      entityNode(
        "e1",
        "usuarios",
        [attr({ id: "a1", name: "id", isPrimaryKey: true })],
        [{ id: "i1", name: "idx_vacio", attributeIds: [], isUnique: false }]
      ),
    ];
    const sql = generateSQL(nodes, [], "postgres");
    expect(sql).not.toContain("idx_vacio");
  });

  it("maps types differently per dialect (varchar -> TEXT on sqlite)", () => {
    const nodes = [
      entityNode("e1", "usuarios", [
        attr({ id: "a1", name: "id", isPrimaryKey: true }),
        attr({ id: "a2", name: "nombre", type: "varchar", length: 100 }),
      ]),
    ];
    const postgres = generateSQL(nodes, [], "postgres");
    const sqlite = generateSQL(nodes, [], "sqlite");
    expect(postgres).toContain("VARCHAR(100)");
    expect(sqlite).toContain('"nombre" TEXT');
  });

  it("ignores non-entity nodes (relationship diamonds, specialization circles)", () => {
    const nodes = [
      entityNode("e1", "usuarios", [attr({ id: "a1", name: "id", isPrimaryKey: true })]),
      {
        id: "d1",
        type: "relationshipDiamond",
        position: { x: 0, y: 0 },
        data: { name: "relacion", isIdentifying: false, isAssociative: false },
      } as unknown as Node<EntityData>,
    ];
    const sql = generateSQL(nodes, [], "postgres");
    const tableCount = (sql.match(/CREATE TABLE/g) || []).length;
    expect(tableCount).toBe(1);
  });
});
