"use client";

import { useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useDiagramStore } from "@/store/diagramStore";
import type { AttributeType, EntityData } from "@/types/diagram";
import { formatAttributeType } from "@/types/diagram";
import FkPicker from "./FkPicker";

const ATTRIBUTE_TYPES: AttributeType[] = [
  "integer",
  "bigint",
  "varchar",
  "text",
  "boolean",
  "date",
  "datetime",
  "decimal",
  "float",
  "uuid",
  "json",
];

export default function EntityNode({ id, data }: NodeProps<EntityData>) {
  const renameEntity = useDiagramStore((s) => s.renameEntity);
  const toggleEntityKind = useDiagramStore((s) => s.toggleEntityKind);
  const toggleEntityAssociative = useDiagramStore((s) => s.toggleEntityAssociative);
  const addAttribute = useDiagramStore((s) => s.addAttribute);
  const updateAttribute = useDiagramStore((s) => s.updateAttribute);
  const removeAttribute = useDiagramStore((s) => s.removeAttribute);
  const addIndex = useDiagramStore((s) => s.addIndex);
  const updateIndex = useDiagramStore((s) => s.updateIndex);
  const removeIndex = useDiagramStore((s) => s.removeIndex);
  const toggleIndexAttribute = useDiagramStore((s) => s.toggleIndexAttribute);

  const [fkPickerAttrId, setFkPickerAttrId] = useState<string | null>(null);
  const [showIndexes, setShowIndexes] = useState(false);

  const isWeak = data.kind === "weak";

  return (
    <div
      className={`min-w-[260px] rounded-md bg-orange-50 text-sm shadow-md ${
        isWeak ? "border-4 border-double border-red-800" : "border-2 border-orange-800"
      } ${data.isAssociative ? "outline outline-2 outline-dashed outline-purple-500" : ""}`}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />

      <div className="flex items-center justify-between gap-1 rounded-t border-b border-orange-800 bg-orange-200 px-2 py-1">
        <input
          className="w-full bg-transparent font-bold outline-none"
          value={data.name}
          onChange={(e) => renameEntity(id, e.target.value)}
        />
        <button
          title="Alternar entidad fuerte / débil"
          className="shrink-0 rounded bg-orange-300 px-1 text-[10px] hover:bg-orange-400"
          onClick={() => toggleEntityKind(id)}
        >
          {isWeak ? "débil" : "fuerte"}
        </button>
        <button
          title="Entidad asociativa (relación N:M con atributos propios)"
          className={`shrink-0 rounded px-1 text-[10px] ${
            data.isAssociative ? "bg-purple-400 text-white" : "bg-gray-200 text-gray-500"
          }`}
          onClick={() => toggleEntityAssociative(id)}
        >
          assoc
        </button>
      </div>

      <div className="divide-y divide-orange-200">
        {data.attributes.map((attr) => (
          <div key={attr.id} className="relative flex items-center gap-1 px-2 py-1">
            <input
              type="checkbox"
              title="Primary Key"
              checked={attr.isPrimaryKey}
              onChange={(e) => updateAttribute(id, attr.id, { isPrimaryKey: e.target.checked })}
            />
            <input
              type="checkbox"
              title="Llave parcial (weak key) de entidad débil"
              checked={attr.isPartialKey}
              onChange={(e) => updateAttribute(id, attr.id, { isPartialKey: e.target.checked })}
              className="accent-red-700"
            />
            <input
              className={`w-20 bg-transparent outline-none ${
                attr.isPrimaryKey ? "underline decoration-solid" : ""
              } ${attr.isPartialKey ? "underline decoration-dotted" : ""}`}
              value={attr.name}
              onChange={(e) => updateAttribute(id, attr.id, { name: e.target.value })}
            />
            <select
              className="flex-1 bg-transparent text-xs outline-none"
              value={attr.type}
              onChange={(e) =>
                updateAttribute(id, attr.id, { type: e.target.value as AttributeType })
              }
            >
              {ATTRIBUTE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {formatAttributeType({ ...attr, type: t })}
                </option>
              ))}
            </select>
            <button
              title="NULL permitido"
              className={`text-[9px] ${attr.nullable ? "text-blue-600" : "text-gray-300"}`}
              onClick={() => updateAttribute(id, attr.id, { nullable: !attr.nullable })}
            >
              NULL
            </button>
            <button
              title={
                attr.isForeignKey
                  ? `FK → ${attr.references ? "vinculada" : "sin destino"}`
                  : "Marcar / vincular Foreign Key"
              }
              className={`text-[10px] ${
                attr.isForeignKey && attr.references
                  ? "font-bold text-blue-700"
                  : attr.isForeignKey
                    ? "font-bold text-yellow-600"
                    : "text-gray-400"
              }`}
              onClick={() => setFkPickerAttrId(fkPickerAttrId === attr.id ? null : attr.id)}
            >
              FK
            </button>
            <button
              className="text-[10px] text-red-500 hover:text-red-700"
              onClick={() => removeAttribute(id, attr.id)}
            >
              ✕
            </button>

            {fkPickerAttrId === attr.id && (
              <FkPicker
                entityId={id}
                attribute={attr}
                onClose={() => setFkPickerAttrId(null)}
              />
            )}
          </div>
        ))}
      </div>

      <button
        className="w-full border-t border-orange-800 bg-orange-100 py-1 text-xs hover:bg-orange-200"
        onClick={() => addAttribute(id)}
      >
        + atributo
      </button>

      <button
        className="w-full rounded-b border-t border-orange-300 bg-orange-50 py-1 text-[10px] text-orange-800 hover:bg-orange-100"
        onClick={() => setShowIndexes(!showIndexes)}
      >
        {showIndexes ? "▲ ocultar índices" : `▼ índices (${data.indexes.length})`}
      </button>

      {showIndexes && (
        <div className="rounded-b border-t border-orange-300 bg-orange-50 p-2 text-[10px]">
          {data.indexes.map((idx) => (
            <div key={idx.id} className="mb-2 rounded border border-orange-300 bg-white p-1">
              <div className="mb-1 flex items-center gap-1">
                <input
                  className="flex-1 bg-transparent font-mono outline-none"
                  value={idx.name}
                  onChange={(e) => updateIndex(id, idx.id, { name: e.target.value })}
                />
                <label className="flex items-center gap-0.5" title="Índice único">
                  <input
                    type="checkbox"
                    checked={idx.isUnique}
                    onChange={(e) => updateIndex(id, idx.id, { isUnique: e.target.checked })}
                  />
                  UNIQUE
                </label>
                <button
                  className="text-red-500 hover:text-red-700"
                  onClick={() => removeIndex(id, idx.id)}
                >
                  ✕
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {data.attributes.map((attr) => (
                  <label key={attr.id} className="flex items-center gap-0.5">
                    <input
                      type="checkbox"
                      checked={idx.attributeIds.includes(attr.id)}
                      onChange={() => toggleIndexAttribute(id, idx.id, attr.id)}
                    />
                    {attr.name}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <button
            className="w-full rounded border border-dashed border-orange-400 py-0.5 hover:bg-orange-100"
            onClick={() => addIndex(id)}
          >
            + índice
          </button>
        </div>
      )}
    </div>
  );
}
