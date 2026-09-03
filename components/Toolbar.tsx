"use client";

import { useRef, useState } from "react";
import { useDiagramStore } from "@/store/diagramStore";
import { generateSQL, type SqlDialect } from "@/lib/sqlExport";

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Toolbar() {
  const addEntity = useDiagramStore((s) => s.addEntity);
  const addRelationshipDiamond = useDiagramStore((s) => s.addRelationshipDiamond);
  const addSpecialization = useDiagramStore((s) => s.addSpecialization);
  const exportDiagram = useDiagramStore((s) => s.exportDiagram);
  const importDiagram = useDiagramStore((s) => s.importDiagram);
  const nodes = useDiagramStore((s) => s.nodes);
  const edges = useDiagramStore((s) => s.edges);
  const [dialect, setDialect] = useState<SqlDialect>("postgres");
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-gray-300 bg-white px-3 py-2 shadow-sm">
      <button
        className="rounded bg-orange-600 px-3 py-1 text-sm text-white hover:bg-orange-700"
        onClick={() => addEntity({ x: 100, y: 100 })}
      >
        + Entidad
      </button>

      <button
        className="rounded bg-yellow-500 px-3 py-1 text-sm text-white hover:bg-yellow-600"
        onClick={() => addRelationshipDiamond({ x: 300, y: 250 })}
        title="Diamante de relación (notación Chen) — conectalo arrastrando desde/hacia entidades"
      >
        + Relación (◇)
      </button>

      <button
        className="rounded bg-gray-700 px-3 py-1 text-sm text-white hover:bg-gray-800"
        onClick={() => addSpecialization({ x: 500, y: 150 })}
        title="Especialización/Generalización (ISA) — conectá la superclase arriba y las subclases abajo"
      >
        + ISA (d/o)
      </button>

      <div className="mx-2 h-6 w-px bg-gray-300" />

      <button
        className="rounded border px-3 py-1 text-sm hover:bg-gray-100"
        onClick={() => download("diagram.json", exportDiagram(), "application/json")}
      >
        Exportar JSON
      </button>

      <button
        className="rounded border px-3 py-1 text-sm hover:bg-gray-100"
        onClick={() => fileInputRef.current?.click()}
      >
        Importar JSON
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => importDiagram(reader.result as string);
          reader.readAsText(file);
        }}
      />

      <div className="mx-2 h-6 w-px bg-gray-300" />

      <select
        className="rounded border px-2 py-1 text-sm"
        value={dialect}
        onChange={(e) => setDialect(e.target.value as SqlDialect)}
      >
        <option value="postgres">PostgreSQL</option>
        <option value="mysql">MySQL</option>
        <option value="sqlite">SQLite</option>
      </select>
      <button
        className="rounded border px-3 py-1 text-sm hover:bg-gray-100"
        onClick={() =>
          download(`schema-${dialect}.sql`, generateSQL(nodes, edges, dialect), "text/plain")
        }
      >
        Exportar SQL
      </button>
    </div>
  );
}
