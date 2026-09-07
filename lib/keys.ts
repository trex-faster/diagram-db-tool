import type { Attribute, EntityData } from "@/types/diagram";

export interface CandidateKey {
  attributeIds: string[];
  label: string;
}

export interface KeyReport {
  primaryKey: Attribute[];
  isCompositePK: boolean;
  foreignKeys: Attribute[];
  partialKeys: Attribute[];
  /**
   * Candidate Keys: cualquier atributo o combinación UNIQUE + NOT NULL que PODRÍA haber sido
   * la PK pero no fue elegida. Las que no son la PK real también se llaman "Alternate Keys"
   * — son el mismo concepto visto desde dos nombres distintos en la bibliografía clásica.
   */
  candidateKeys: CandidateKey[];
}

export function classifyKeys(entity: EntityData): KeyReport {
  const primaryKey = entity.attributes.filter((a) => a.isPrimaryKey);
  const foreignKeys = entity.attributes.filter((a) => a.isForeignKey);
  const partialKeys = entity.attributes.filter((a) => a.isPartialKey);
  const pkIds = new Set(primaryKey.map((a) => a.id));

  const candidateKeys: CandidateKey[] = [];

  // Candidatas de un solo atributo: cualquier UNIQUE (+ NOT NULL) que no sea ya la PK.
  for (const attr of entity.attributes) {
    if (attr.isUnique && !attr.nullable && !pkIds.has(attr.id)) {
      candidateKeys.push({ attributeIds: [attr.id], label: attr.name });
    }
  }

  // Candidatas compuestas: índices UNIQUE que no coincidan exactamente con la PK.
  for (const idx of entity.indexes) {
    if (!idx.isUnique || idx.attributeIds.length === 0) continue;
    const isSameAsPk =
      idx.attributeIds.length === primaryKey.length && idx.attributeIds.every((id) => pkIds.has(id));
    if (isSameAsPk) continue;
    const names = idx.attributeIds.map((id) => entity.attributes.find((a) => a.id === id)?.name ?? "?");
    candidateKeys.push({ attributeIds: idx.attributeIds, label: names.join(" + ") });
  }

  return {
    primaryKey,
    isCompositePK: primaryKey.length > 1,
    foreignKeys,
    partialKeys,
    candidateKeys,
  };
}
