import type { EntityData } from "@/types/diagram";
import { validateIdentifier } from "@/lib/naming";

export interface EntityWarning {
  attributeId?: string;
  message: string;
}

/**
 * Chequeos rápidos, no exhaustivos, pensados para avisar ANTES de exportar SQL en vez
 * de que el usuario descubra el problema cuando el script falla contra una base real.
 */
export function getEntityWarnings(entity: EntityData): EntityWarning[] {
  const warnings: EntityWarning[] = [];

  const hasPrimaryKey = entity.attributes.some((a) => a.isPrimaryKey);
  if (!hasPrimaryKey) {
    warnings.push({ message: `"${entity.name}" no tiene ninguna Primary Key.` });
  }

  const entityNameCheck = validateIdentifier(entity.name, "entidad");
  if (!entityNameCheck.valid) {
    warnings.push({ message: `Nombre de tabla "${entity.name}": ${entityNameCheck.reason}` });
  }

  for (const attr of entity.attributes) {
    if (attr.isForeignKey && !attr.references) {
      warnings.push({
        attributeId: attr.id,
        message: `"${attr.name}" está marcada como FK pero no apunta a ninguna tabla/columna.`,
      });
    }
    if (!attr.name.trim()) {
      warnings.push({ attributeId: attr.id, message: "Hay un atributo sin nombre." });
    } else {
      const attrNameCheck = validateIdentifier(attr.name, "atributo");
      if (!attrNameCheck.valid) {
        warnings.push({ attributeId: attr.id, message: `"${attr.name}": ${attrNameCheck.reason}` });
      }
    }
    // Buena práctica: toda FK real (con destino) debería estar indexada — si no, los JOINs
    // hacia esta tabla escanean todo en vez de usar un índice.
    if (attr.isForeignKey && attr.references) {
      const isIndexed = entity.indexes.some(
        (idx) => idx.attributeIds.length >= 1 && idx.attributeIds[0] === attr.id
      );
      if (!isIndexed) {
        warnings.push({
          attributeId: attr.id,
          message: `"${attr.name}" es FK pero no tiene índice — los JOINs hacia esta columna van a ser lentos.`,
        });
      }
    }
  }

  for (const idx of entity.indexes) {
    if (idx.attributeIds.length === 0) {
      warnings.push({ message: `El índice "${idx.name}" no tiene columnas seleccionadas.` });
    }
  }

  const duplicateNames = entity.attributes
    .map((a) => a.name.trim().toLowerCase())
    .filter((name, i, arr) => name && arr.indexOf(name) !== i);
  if (duplicateNames.length > 0) {
    warnings.push({ message: `Hay nombres de atributo repetidos: ${[...new Set(duplicateNames)].join(", ")}.` });
  }

  return warnings;
}
