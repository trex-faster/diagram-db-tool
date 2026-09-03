export type AttributeType =
  | "integer"
  | "bigint"
  | "varchar"
  | "text"
  | "boolean"
  | "date"
  | "datetime"
  | "decimal"
  | "float"
  | "uuid"
  | "json";

export interface AttributeReference {
  entityId: string;
  attributeId: string;
}

export interface Attribute {
  id: string;
  name: string;
  type: AttributeType;
  length?: number;
  precision?: number;
  scale?: number;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isPartialKey: boolean; // llave parcial de entidad débil (subrayado punteado)
  isUnique: boolean;
  defaultValue?: string;
  references?: AttributeReference;

  // --- Nivel conceptual (EER, Elmasri/Navathe) ---
  /** Atributo multivaluado, ej. Teléfonos. Se representa como {nombre}. */
  isMultivalued: boolean;
  /** Atributo derivado, ej. Edad a partir de FechaNacimiento. Se representa como /nombre. */
  isDerived: boolean;
  /** Atributo compuesto, ej. Dirección = Calle + Ciudad + CP. Agrupa sub-atributos. */
  isComposite: boolean;
  /** Si este atributo es sub-atributo de uno compuesto, el id del padre. */
  parentAttributeId?: string;
}

export type EntityKind = "strong" | "weak";

/** Índice compuesto o simple sobre una o más columnas de la entidad. */
export interface IndexDef {
  id: string;
  name: string;
  attributeIds: string[];
  isUnique: boolean;
}

export interface EntityData {
  name: string;
  kind: EntityKind;
  /** Entidad asociativa (representa una relación N:M con atributos propios). Estilo DIA "Associative". */
  isAssociative: boolean;
  attributes: Attribute[];
  indexes: IndexDef[];
  color?: string;
}

export type Cardinality = "1" | "N" | "0..1" | "0..N" | "1..N";

/**
 * Línea directa entidad-entidad (notación crow's foot), sin diamante de relación.
 * Útil para conexiones rápidas de nivel lógico/físico.
 */
export interface DirectRelationshipData {
  name: string;
  sourceCardinality: Cardinality;
  targetCardinality: Cardinality;
  isIdentifying: boolean;
}

/**
 * Nodo diamante de relación (notación Chen), estilo DIA: se conecta a 2+ entidades,
 * cada conexión (CardinalityLinkData) lleva su propia cardinalidad.
 */
export interface RelationshipDiamondData {
  name: string;
  isIdentifying: boolean;
  isAssociative: boolean;
}

export type Participation = "partial" | "total";

/** Conexión entidad <-> diamante de relación. Lleva la cardinalidad de ESE lado. */
export interface CardinalityLinkData {
  cardinality: Cardinality;
  /** Restricción de participación (Elmasri/Navathe): total = línea doble, parcial = línea simple. */
  participation: Participation;
  /** Rol opcional — imprescindible en relaciones recursivas/n-arias, ej: "supervisor" / "supervisado". */
  role?: string;
}

export type SpecializationConstraint = "disjoint" | "overlapping";
export type SpecializationCompleteness = "total" | "partial";

/**
 * Nodo de especialización/generalización (jerarquía ISA), estilo Elmasri/Navathe:
 * un círculo con "d" (disjoint) u "o" (overlapping), conectado a una superclase
 * y a una o más subclases mediante IsaLinkData.
 */
export interface SpecializationData {
  constraint: SpecializationConstraint;
  completeness: SpecializationCompleteness;
  /** Nombre opcional del discriminador, ej. "tipo_vehiculo". */
  discriminator?: string;
}

/** Conexión superclase<->círculo ISA<->subclase. Sin datos propios; el estilo sale del nodo. */
export type IsaLinkData = Record<string, never>;

export interface Diagram {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export const ATTRIBUTE_TYPE_LABELS: Record<AttributeType, string> = {
  integer: "INTEGER",
  bigint: "BIGINT",
  varchar: "VARCHAR",
  text: "TEXT",
  boolean: "BOOLEAN",
  date: "DATE",
  datetime: "DATETIME",
  decimal: "DECIMAL",
  float: "FLOAT",
  uuid: "UUID",
  json: "JSON",
};

export function formatAttributeType(attr: Attribute): string {
  const label = ATTRIBUTE_TYPE_LABELS[attr.type];
  if (attr.type === "varchar" && attr.length) return `${label}(${attr.length})`;
  if (attr.type === "decimal" && attr.precision !== undefined) {
    return `${label}(${attr.precision}${attr.scale !== undefined ? `,${attr.scale}` : ""})`;
  }
  return label;
}
