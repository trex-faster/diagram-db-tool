import type { Edge, Node } from "@xyflow/react";
import type { AttributeType, EntityData } from "@/types/diagram";

export type SqlDialect = "postgres" | "mysql" | "sqlite";

const TYPE_MAP: Record<SqlDialect, Record<AttributeType, string>> = {
  postgres: {
    integer: "INTEGER",
    bigint: "BIGINT",
    varchar: "VARCHAR",
    text: "TEXT",
    boolean: "BOOLEAN",
    date: "DATE",
    datetime: "TIMESTAMP",
    decimal: "DECIMAL",
    float: "REAL",
    uuid: "UUID",
    json: "JSONB",
  },
  mysql: {
    integer: "INT",
    bigint: "BIGINT",
    varchar: "VARCHAR",
    text: "TEXT",
    boolean: "TINYINT(1)",
    date: "DATE",
    datetime: "DATETIME",
    decimal: "DECIMAL",
    float: "FLOAT",
    uuid: "CHAR(36)",
    json: "JSON",
  },
  sqlite: {
    integer: "INTEGER",
    bigint: "INTEGER",
    varchar: "TEXT",
    text: "TEXT",
    boolean: "INTEGER",
    date: "TEXT",
    datetime: "TEXT",
    decimal: "NUMERIC",
    float: "REAL",
    uuid: "TEXT",
    json: "TEXT",
  },
};

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/** Solo los nodos de tipo "entity" describen tablas; los diamantes de relación no generan DDL directo. */
function entityNodes(nodes: Node<unknown>[]): Node<EntityData>[] {
  return nodes.filter((n): n is Node<EntityData> => n.type === "entity");
}

export function generateSQL(
  nodes: Node<unknown>[],
  edges: Edge<unknown>[],
  dialect: SqlDialect = "postgres"
): string {
  const typeMap = TYPE_MAP[dialect];
  const tables = entityNodes(nodes);
  const statements: string[] = [];

  for (const node of tables) {
    const { name, attributes, indexes } = node.data;
    const lines: string[] = [];
    const primaryKeys: string[] = [];

    for (const attr of attributes) {
      let colType = typeMap[attr.type];
      if (attr.type === "varchar") colType += `(${attr.length ?? 255})`;
      if (attr.type === "decimal") {
        colType += `(${attr.precision ?? 10},${attr.scale ?? 2})`;
      }

      const parts = [quoteIdent(attr.name), colType];
      if (!attr.nullable) parts.push("NOT NULL");
      if (attr.isUnique) parts.push("UNIQUE");
      if (attr.defaultValue) parts.push(`DEFAULT ${attr.defaultValue}`);

      lines.push("  " + parts.join(" "));
      if (attr.isPrimaryKey) primaryKeys.push(quoteIdent(attr.name));
    }

    if (primaryKeys.length > 0) {
      lines.push(`  PRIMARY KEY (${primaryKeys.join(", ")})`);
    }

    // Foreign keys reales, vinculadas mediante el picker de FK (attribute.references).
    for (const attr of attributes) {
      if (attr.isForeignKey && attr.references) {
        const refEntity = tables.find((n) => n.id === attr.references!.entityId);
        const refAttr = refEntity?.data.attributes.find(
          (a) => a.id === attr.references!.attributeId
        );
        if (refEntity && refAttr) {
          lines.push(
            `  FOREIGN KEY (${quoteIdent(attr.name)}) REFERENCES ${quoteIdent(
              refEntity.data.name
            )}(${quoteIdent(refAttr.name)})`
          );
        }
      }
    }

    statements.push(`CREATE TABLE ${quoteIdent(name)} (\n${lines.join(",\n")}\n);`);

    // Índices declarados en la entidad (simples o compuestos).
    for (const idx of indexes) {
      if (idx.attributeIds.length === 0) continue;
      const cols = idx.attributeIds
        .map((attrId) => attributes.find((a) => a.id === attrId))
        .filter((a): a is NonNullable<typeof a> => Boolean(a))
        .map((a) => quoteIdent(a.name));
      if (cols.length === 0) continue;
      const unique = idx.isUnique ? "UNIQUE " : "";
      statements.push(
        `CREATE ${unique}INDEX ${quoteIdent(idx.name)} ON ${quoteIdent(name)} (${cols.join(", ")});`
      );
    }
  }

  return statements.join("\n\n");
}
