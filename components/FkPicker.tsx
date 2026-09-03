"use client";

import { useState } from "react";
import { useDiagramStore } from "@/store/diagramStore";
import type { Attribute, EntityData } from "@/types/diagram";
import type { Node } from "@xyflow/react";

export default function FkPicker({
  entityId,
  attribute,
  onClose,
}: {
  entityId: string;
  attribute: Attribute;
  onClose: () => void;
}) {
  const nodes = useDiagramStore((s) => s.nodes) as Node<EntityData>[];
  const linkForeignKey = useDiagramStore((s) => s.linkForeignKey);

  const entities = nodes.filter((n) => n.type === "entity" && n.id !== entityId);
  const currentTargetEntityId = attribute.references?.entityId ?? "";
  const [targetEntityId, setTargetEntityId] = useState(currentTargetEntityId);

  const targetEntity = entities.find((e) => e.id === targetEntityId);

  return (
    <div
      className="absolute z-20 w-56 rounded border border-gray-400 bg-white p-2 text-xs shadow-lg"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-1 font-bold">Vincular Foreign Key</div>

      <label className="mb-1 block">
        Tabla destino
        <select
          className="mt-0.5 w-full rounded border px-1 py-0.5"
          value={targetEntityId}
          onChange={(e) => setTargetEntityId(e.target.value)}
        >
          <option value="">— ninguna —</option>
          {entities.map((e) => (
            <option key={e.id} value={e.id}>
              {e.data.name}
            </option>
          ))}
        </select>
      </label>

      {targetEntity && (
        <label className="mb-2 block">
          Columna destino
          <select
            className="mt-0.5 w-full rounded border px-1 py-0.5"
            defaultValue=""
            onChange={(e) => {
              const targetAttributeId = e.target.value;
              if (!targetAttributeId) return;
              linkForeignKey(entityId, attribute.id, {
                entityId: targetEntityId,
                attributeId: targetAttributeId,
              });
              onClose();
            }}
          >
            <option value="" disabled>
              elegir columna...
            </option>
            {targetEntity.data.attributes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} {a.isPrimaryKey ? "(PK)" : ""}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="flex justify-between">
        <button
          className="text-red-600 hover:underline"
          onClick={() => {
            linkForeignKey(entityId, attribute.id, null);
            onClose();
          }}
        >
          Quitar FK
        </button>
        <button className="text-gray-500 hover:underline" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
