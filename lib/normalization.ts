import type { Node } from "@xyflow/react";
import type { EntityData } from "@/types/diagram";

export interface NormalizationIssue {
  form: "1NF" | "2NF" | "3NF" | "4NF";
  /**
   * "violation": estructuralmente detectable con certeza a partir del diagrama.
   * "heuristic": es un ALERTA para que lo revises vos — normalizar de verdad más allá de
   * 1FN requiere conocer las dependencias funcionales reales de tu negocio, que un diagrama
   * ER no captura. Esto es una sospecha razonable, no una prueba matemática.
   */
  severity: "violation" | "heuristic";
  message: string;
  attributeId?: string;
}

/** 1FN: valores atómicos. Esto SÍ es 100% derivable de la estructura del diagrama. */
function check1NF(entity: EntityData): NormalizationIssue[] {
  const issues: NormalizationIssue[] = [];
  for (const attr of entity.attributes) {
    if (attr.isMultivalued) {
      issues.push({
        form: "1NF",
        severity: "violation",
        attributeId: attr.id,
        message: `"${attr.name}" es multivaluado — 1FN exige valores atómicos. Separalo en una tabla "${entity.name}_${attr.name}" con FK hacia "${entity.name}".`,
      });
    }
    if (attr.isComposite) {
      const hasChildren = entity.attributes.some((a) => a.parentAttributeId === attr.id);
      if (!hasChildren) {
        issues.push({
          form: "1NF",
          severity: "violation",
          attributeId: attr.id,
          message: `"${attr.name}" está marcado como compuesto pero no tiene sub-atributos — o le agregás sub-atributos o dejá de marcarlo compuesto.`,
        });
      }
    }
  }
  return issues;
}

/**
 * 2FN: ningún atributo no-clave depende de solo UNA PARTE de una clave compuesta.
 * Esto NO es derivable con certeza sin conocer las dependencias funcionales reales — el
 * diagrama no te dice "este atributo depende de esta mitad de la clave". Lo que SÍ podemos
 * hacer con certeza estructural es detectar el escenario donde el problema PUEDE existir
 * (PK compuesta + atributos no-clave) y pedirte que lo revises vos.
 */
function check2NF(entity: EntityData): NormalizationIssue[] {
  const pkAttrs = entity.attributes.filter((a) => a.isPrimaryKey);
  if (pkAttrs.length < 2) return []; // 2FN solo es relevante con PK compuesta

  const nonKeyAttrs = entity.attributes.filter((a) => !a.isPrimaryKey && !a.parentAttributeId);
  if (nonKeyAttrs.length === 0) return [];

  return [
    {
      form: "2NF",
      severity: "heuristic",
      message:
        `"${entity.name}" tiene PK compuesta (${pkAttrs.map((a) => a.name).join(", ")}) y ` +
        `${nonKeyAttrs.length} atributo(s) no-clave (${nonKeyAttrs.map((a) => a.name).join(", ")}). ` +
        `Revisá uno por uno: si alguno depende de UNA SOLA parte de la clave (no de las dos juntas), ` +
        `hay dependencia parcial — viola 2FN — y ese atributo debería moverse a la tabla del atributo del que sí depende.`,
    },
  ];
}

/**
 * 3FN: ningún atributo no-clave depende transitivamente de la PK a través de otro atributo
 * no-clave. Tampoco es 100% derivable sin las dependencias funcionales reales, PERO hay un
 * caso concreto que SÍ podemos detectar por estructura: si esta entidad tiene una FK hacia
 * otra entidad, y ADEMÁS guarda una columna con el mismo nombre que una columna de la tabla
 * referenciada, es un patrón clásico de dato duplicado/transitivo (ej. guardar "ciudad_nombre"
 * en "clientes" cuando ya existe FK a "ciudades" y "ciudades.nombre").
 */
function check3NF(entity: EntityData, allEntities: Node<EntityData>[]): NormalizationIssue[] {
  const issues: NormalizationIssue[] = [];
  const fkAttrs = entity.attributes.filter((a) => a.isForeignKey && a.references);
  const candidates = entity.attributes.filter(
    (a) => !a.isPrimaryKey && !a.isForeignKey && !a.parentAttributeId && !a.isDerived
  );

  for (const fk of fkAttrs) {
    const targetNode = allEntities.find((n) => n.id === fk.references!.entityId);
    if (!targetNode) continue;
    const targetAttrNames = new Set(
      targetNode.data.attributes.filter((a) => !a.isPrimaryKey).map((a) => a.name.trim().toLowerCase())
    );
    for (const candidate of candidates) {
      if (targetAttrNames.has(candidate.name.trim().toLowerCase())) {
        issues.push({
          form: "3NF",
          severity: "heuristic",
          attributeId: candidate.id,
          message:
            `"${candidate.name}" en "${entity.name}" tiene el mismo nombre que una columna en ` +
            `"${targetNode.data.name}" (a la que ya referenciás con "${fk.name}"). Posible dependencia ` +
            `transitiva — si es el mismo dato, traelo con un JOIN en vez de duplicarlo acá.`,
        });
      }
    }
  }
  return issues;
}

/**
 * 4FN: ninguna tabla debe mezclar dos dependencias multivaluadas independientes entre sí.
 * Heurística: si una misma entidad tiene 2+ atributos marcados multivaluados que no tienen
 * relación entre sí, es la señal clásica de que deberían vivir en tablas separadas.
 */
function check4NF(entity: EntityData): NormalizationIssue[] {
  const multivalued = entity.attributes.filter((a) => a.isMultivalued);
  if (multivalued.length < 2) return [];
  return [
    {
      form: "4NF",
      severity: "heuristic",
      message:
        `"${entity.name}" tiene ${multivalued.length} atributos multivaluados independientes entre sí ` +
        `(${multivalued.map((a) => a.name).join(", ")}). Combinarlos en la misma tabla intermedia genera una ` +
        `dependencia multivaluada (viola 4FN) — lo más seguro es una tabla separada por cada uno.`,
    },
  ];
}

export function getNormalizationReport(
  entityNode: Node<EntityData>,
  allEntities: Node<EntityData>[]
): NormalizationIssue[] {
  const entity = entityNode.data;
  return [
    ...check1NF(entity),
    ...check2NF(entity),
    ...check3NF(entity, allEntities),
    ...check4NF(entity),
  ];
}
