"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { toPng } from "html-to-image";
import { useDiagramStore } from "@/store/diagramStore";
import { generateSQL, type SqlDialect } from "@/lib/sqlExport";
import { deleteDiagram, listDiagrams, loadDiagram, type DiagramRecord } from "@/lib/db";
import AnalysisPanel from "./AnalysisPanel";
import { TEMPLATES } from "@/lib/templates";

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Toolbar({ canvasRef }: { canvasRef: RefObject<HTMLDivElement | null> }) {
  const addEntity = useDiagramStore((s) => s.addEntity);
  const addRelationshipDiamond = useDiagramStore((s) => s.addRelationshipDiamond);
  const addSpecialization = useDiagramStore((s) => s.addSpecialization);
  const exportDiagram = useDiagramStore((s) => s.exportDiagram);
  const importDiagram = useDiagramStore((s) => s.importDiagram);
  const loadSnapshot = useDiagramStore((s) => s.loadSnapshot);
  const newDiagram = useDiagramStore((s) => s.newDiagram);
  const renameDiagram = useDiagramStore((s) => s.renameDiagram);
  const diagramName = useDiagramStore((s) => s.diagramName);
  const diagramId = useDiagramStore((s) => s.diagramId);
  const undo = useDiagramStore((s) => s.undo);
  const redo = useDiagramStore((s) => s.redo);
  const historyPastLen = useDiagramStore((s) => s.history.past.length);
  const historyFutureLen = useDiagramStore((s) => s.history.future.length);
  const nodes = useDiagramStore((s) => s.nodes);
  const edges = useDiagramStore((s) => s.edges);

  const [dialect, setDialect] = useState<SqlDialect>("postgres");
  const [importError, setImportError] = useState<string | null>(null);
  const [showDiagrams, setShowDiagrams] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [savedDiagrams, setSavedDiagrams] = useState<DiagramRecord[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!showDiagrams) return;
    listDiagrams()
      .then(setSavedDiagrams)
      .catch(() => setSavedDiagrams([]));
  }, [showDiagrams]);

  return (
    <div className="flex flex-col border-b border-gray-300 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <input
          className="w-40 rounded border px-2 py-1 text-sm font-semibold"
          value={diagramName}
          onChange={(e) => renameDiagram(e.target.value)}
          title="Nombre del diagrama (se autoguarda)"
        />

        <div className="mx-1 h-6 w-px bg-gray-300" />

        <button
          className="rounded bg-orange-600 px-3 py-1 text-sm text-white hover:bg-orange-700"
          onClick={() => addEntity({ x: 100, y: 100 })}
        >
          + Entidad
        </button>
        <button
          className="rounded bg-yellow-500 px-3 py-1 text-sm text-white hover:bg-yellow-600"
          onClick={() => addRelationshipDiamond({ x: 300, y: 250 })}
          title="Diamante de relación (notación Chen)"
        >
          + Relación (◇)
        </button>
        <button
          className="rounded bg-gray-700 px-3 py-1 text-sm text-white hover:bg-gray-800"
          onClick={() => addSpecialization({ x: 500, y: 150 })}
          title="Especialización/Generalización (ISA)"
        >
          + ISA (d/o)
        </button>

        <div className="mx-1 h-6 w-px bg-gray-300" />

        <button
          className="rounded border px-2 py-1 text-sm hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
          onClick={undo}
          disabled={historyPastLen === 0}
          title="Deshacer (Ctrl+Z)"
        >
          ↶ Deshacer
        </button>
        <button
          className="rounded border px-2 py-1 text-sm hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
          onClick={redo}
          disabled={historyFutureLen === 0}
          title="Rehacer (Ctrl+Shift+Z)"
        >
          ↷ Rehacer
        </button>

        <div className="mx-1 h-6 w-px bg-gray-300" />

        <div className="relative">
          <button
            className="rounded border px-3 py-1 text-sm hover:bg-gray-100"
            onClick={() => setShowDiagrams((v) => !v)}
          >
            📁 Diagramas
          </button>
          {showDiagrams && (
            <div className="absolute left-0 top-full z-30 mt-1 w-64 rounded border bg-white p-2 text-sm shadow-lg">
              <button
                className="mb-2 w-full rounded bg-orange-600 px-2 py-1 text-left text-white hover:bg-orange-700"
                onClick={() => {
                  newDiagram();
                  setShowDiagrams(false);
                }}
              >
                + Nuevo diagrama
              </button>
              {savedDiagrams.length === 0 && (
                <p className="px-1 text-xs text-gray-400">No hay diagramas guardados todavía.</p>
              )}
              <ul className="max-h-60 overflow-y-auto">
                {savedDiagrams.map((d) => (
                  <li key={d.id} className="flex items-center gap-1 rounded px-1 py-1 hover:bg-gray-50">
                    <button
                      className={`flex-1 truncate text-left ${d.id === diagramId ? "font-bold text-orange-700" : ""}`}
                      onClick={async () => {
                        const full = await loadDiagram(d.id);
                        if (full) {
                          loadSnapshot(
                            { nodes: full.nodes as never, edges: full.edges as never },
                            { id: full.id, name: full.name }
                          );
                        }
                        setShowDiagrams(false);
                      }}
                      title={new Date(d.updatedAt).toLocaleString()}
                    >
                      {d.name}
                    </button>
                    <button
                      className="text-xs text-red-500 hover:text-red-700"
                      onClick={async () => {
                        await deleteDiagram(d.id);
                        setSavedDiagrams(await listDiagrams());
                      }}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="mx-1 h-6 w-px bg-gray-300" />

        <button
          className="rounded border px-3 py-1 text-sm hover:bg-gray-100"
          onClick={() => download(`${diagramName || "diagram"}.json`, exportDiagram(), "application/json")}
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
            reader.onload = () => {
              try {
                importDiagram(reader.result as string);
                setImportError(null);
              } catch (err) {
                // Nunca dejamos que un JSON corrupto tire abajo la app entera:
                // avisamos y el diagrama actual queda intacto.
                setImportError(
                  err instanceof Error ? err.message : "No se pudo leer el archivo importado."
                );
              }
            };
            reader.onerror = () => setImportError("No se pudo leer el archivo.");
            reader.readAsText(file);
            e.target.value = ""; // permite reimportar el mismo archivo dos veces seguidas
          }}
        />

        <button
          className="rounded border px-3 py-1 text-sm hover:bg-gray-100"
          onClick={async () => {
            if (!canvasRef.current) return;
            try {
              const dataUrl = await toPng(canvasRef.current, { backgroundColor: "#ffffff", pixelRatio: 2 });
              const a = document.createElement("a");
              a.href = dataUrl;
              a.download = `${diagramName || "diagram"}.png`;
              a.click();
            } catch {
              setImportError("No se pudo exportar la imagen PNG.");
            }
          }}
        >
          Exportar PNG
        </button>

        <div className="mx-1 h-6 w-px bg-gray-300" />

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
          onClick={() => download(`schema-${dialect}.sql`, generateSQL(nodes, edges, dialect), "text/plain")}
        >
          Exportar SQL
        </button>

        <div className="mx-1 h-6 w-px bg-gray-300" />

        <div className="relative">
          <button
            className="rounded border px-3 py-1 text-sm hover:bg-gray-100"
            onClick={() => setShowTemplates((v) => !v)}
          >
            📚 Plantillas
          </button>
          {showTemplates && (
            <div className="absolute left-0 top-full z-30 mt-1 w-80 rounded border bg-white p-2 text-sm shadow-lg">
              <p className="mb-2 text-xs text-gray-400">
                Carga un modelo de ejemplo listo (reemplaza el diagrama actual — exportá primero si querés conservarlo).
              </p>
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  className="mb-1 block w-full rounded p-1 text-left hover:bg-gray-50"
                  onClick={() => {
                    const built = t.build();
                    newDiagram();
                    loadSnapshot({ nodes: built.nodes, edges: built.edges }, { id: crypto.randomUUID(), name: built.name });
                    setShowTemplates(false);
                  }}
                >
                  <div className="font-semibold text-orange-800">{t.label}</div>
                  <div className="text-xs text-gray-500">{t.description}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          className="rounded border px-3 py-1 text-sm hover:bg-gray-100"
          onClick={() => setShowAnalysis(true)}
        >
          📊 Análisis
        </button>
      </div>

      {importError && (
        <div className="flex items-center justify-between bg-red-50 px-3 py-1 text-xs text-red-700">
          <span>⚠ {importError}</span>
          <button className="font-bold" onClick={() => setImportError(null)}>
            ✕
          </button>
        </div>
      )}

      {showAnalysis && <AnalysisPanel onClose={() => setShowAnalysis(false)} />}
    </div>
  );
}
