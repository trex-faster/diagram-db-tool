import { describe, expect, it } from "vitest";
import { TEMPLATES } from "./templates";
import { generateSQL } from "./sqlExport";
import { getEntityWarnings } from "./validation";
import type { EntityData } from "@/types/diagram";
import type { Node } from "@xyflow/react";

describe("TEMPLATES", () => {
  it("every template builds without throwing and returns nodes+edges", () => {
    for (const t of TEMPLATES) {
      const built = t.build();
      expect(built.nodes.length).toBeGreaterThan(0);
      expect(Array.isArray(built.edges)).toBe(true);
    }
  });

  it("every generated node has unique ids and every attribute has a unique id within its entity", () => {
    for (const t of TEMPLATES) {
      const built = t.build();
      const nodeIds = built.nodes.map((n) => n.id);
      expect(new Set(nodeIds).size).toBe(nodeIds.length);

      for (const node of built.nodes) {
        const entity = node.data as EntityData;
        const attrIds = entity.attributes.map((a) => a.id);
        expect(new Set(attrIds).size).toBe(attrIds.length);
      }
    }
  });

  it("every edge references node ids that actually exist in the template", () => {
    for (const t of TEMPLATES) {
      const built = t.build();
      const nodeIds = new Set(built.nodes.map((n) => n.id));
      for (const edge of built.edges) {
        expect(nodeIds.has(edge.source)).toBe(true);
        expect(nodeIds.has(edge.target)).toBe(true);
      }
    }
  });
});

describe("CRM template (flagship)", () => {
  const crm = TEMPLATES.find((t) => t.id === "crm-advanced")!;

  it("exists and builds 25 entities", () => {
    const built = crm.build();
    expect(built.nodes).toHaveLength(25);
  });

  it("self-referencing FKs (manager_id, parent_account_id) actually have `references` set", () => {
    // Esto es justo el bug que encontramos: mkEntity() clona los atributos, así que mutar la
    // variable local DESPUÉS de crear el nodo no alcanzaba — hay que mutar la copia guardada.
    const built = crm.build();
    const users = built.nodes.find((n) => n.data.name === "users") as Node<EntityData>;
    const managerId = users.data.attributes.find((a) => a.name === "manager_id")!;
    expect(managerId.isForeignKey).toBe(true);
    expect(managerId.references?.entityId).toBe(users.id);

    const accounts = built.nodes.find((n) => n.data.name === "accounts") as Node<EntityData>;
    const parentAccountId = accounts.data.attributes.find((a) => a.name === "parent_account_id")!;
    expect(parentAccountId.isForeignKey).toBe(true);
    expect(parentAccountId.references?.entityId).toBe(accounts.id);
  });

  it("weak entities (contact_phones, order_line_items) are marked kind: weak with a partial key", () => {
    const built = crm.build();
    const contactPhones = built.nodes.find((n) => n.data.name === "contact_phones")!;
    expect(contactPhones.data.kind).toBe("weak");
    expect(contactPhones.data.attributes.some((a) => a.isPartialKey)).toBe(true);

    const orderLineItems = built.nodes.find((n) => n.data.name === "order_line_items")!;
    expect(orderLineItems.data.kind).toBe("weak");
    expect(orderLineItems.data.attributes.some((a) => a.isPartialKey)).toBe(true);
  });

  it("the composite attribute (billing_address) has real sub-attributes", () => {
    const built = crm.build();
    const accounts = built.nodes.find((n) => n.data.name === "accounts")!;
    const composite = accounts.data.attributes.find((a) => a.name === "billing_address")!;
    expect(composite.isComposite).toBe(true);
    const children = accounts.data.attributes.filter((a) => a.parentAttributeId === composite.id);
    expect(children.length).toBeGreaterThanOrEqual(4);
  });

  it("the derived attribute (expected_revenue) is marked derived", () => {
    const built = crm.build();
    const opportunities = built.nodes.find((n) => n.data.name === "opportunities")!;
    const derived = opportunities.data.attributes.find((a) => a.name === "expected_revenue")!;
    expect(derived.isDerived).toBe(true);
  });

  it("polymorphic pairs (activities, notes, taggables, audit_logs) share a polymorphicGroup", () => {
    const built = crm.build();
    for (const entityName of ["activities", "notes", "audit_logs"]) {
      const entity = built.nodes.find((n) => n.data.name === entityName)!;
      const idAttr = entity.data.attributes.find((a) => a.polymorphicRole === "id")!;
      const typeAttr = entity.data.attributes.find((a) => a.polymorphicRole === "type")!;
      expect(idAttr.polymorphicGroup).toBe(typeAttr.polymorphicGroup);
    }
  });

  it("candidate/alternate keys exist for tenant-scoped uniqueness (roles, products, tags)", () => {
    const built = crm.build();
    for (const entityName of ["roles", "products", "tags"]) {
      const entity = built.nodes.find((n) => n.data.name === entityName)!;
      expect(entity.data.indexes.some((idx) => idx.isUnique && idx.attributeIds.length === 2)).toBe(true);
    }
  });

  it("generates valid SQL for the whole CRM without throwing, with real FKs resolved", () => {
    const built = crm.build();
    const sql = generateSQL(built.nodes, built.edges, "postgres");
    expect(sql).toContain('CREATE TABLE "tenants"');
    expect(sql).toContain('CREATE TABLE "opportunity_products"');
    // La FK reflexiva de "users" debe resolver contra la propia tabla "users".
    expect(sql).toMatch(/FOREIGN KEY \("manager_id"\) REFERENCES "users"/);
    // El atributo derivado NO debe generar columna.
    const opportunitiesTable = sql.split("CREATE TABLE")[
      sql.split("CREATE TABLE").findIndex((s) => s.startsWith(' "opportunities"'))
    ];
    expect(opportunitiesTable).not.toContain('"expected_revenue"');
  });

  it("has no unresolved FK warnings (every isForeignKey attribute has a real reference)", () => {
    const built = crm.build();
    for (const node of built.nodes) {
      const warnings = getEntityWarnings(node.data as EntityData);
      const unresolvedFk = warnings.filter((w) => w.message.includes("no apunta"));
      expect(unresolvedFk).toHaveLength(0);
    }
  });
});
