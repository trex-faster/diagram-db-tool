"use client";

import type { Node } from "@xyflow/react";
import { useDiagramStore } from "@/store/diagramStore";
import type { EntityData } from "@/types/diagram";
import { getNormalizationReport } from "@/lib/normalization";
import { classifyKeys } from "@/lib/keys";
import { getEntityWarnings } from "@/lib/validation";

const FORM_LABEL: Record<string, string> = {
  "1NF": "1FN",
  "2NF": "2FN",
  "3NF": "3FN",
  "4NF": "4FN",
};

export default function AnalysisPanel({ onClose }: { onClose: () => void }) {
  const nodes = useDiagramStore((s) => s.nodes);
  const entityNodes = nodes.filter((n): n is Node<EntityData> => n.type === "entity");

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/30 pt-10" onClick={onClose}>
      <div
        className="max-h-[85vh] w-[min(760px,92vw)] overflow-y-auto rounded-lg bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">📊 Análisis del modelo</h2>
          <button className="text-gray-500 hover:text-gray-800" onClick={onClose}>
            ✕
          </button>
        </div>

        <p className="mb-4 rounded bg-amber-50 p-2 text-xs text-amber-800">
          Los avisos de <strong>1FN</strong> son detección real (estructural). Los de{" "}
          <strong>2FN/3FN/4FN</strong> son <strong>heurísticas</strong> — señalan un patrón sospechoso para
          que vos decidas, porque normalizar más allá de 1FN requiere conocer las dependencias
          funcionales reales de tu negocio, que un diagrama ER no captura por sí solo.
        </p>

        {entityNodes.length === 0 && (
          <p className="text-sm text-gray-400">Todavía no hay entidades en el diagrama.</p>
        )}

        {entityNodes.map((node) => {
          const keys = classifyKeys(node.data);
          const normalization = getNormalizationReport(node, entityNodes);
          const warnings = getEntityWarnings(node.data);

          return (
            <div key={node.id} className="mb-4 rounded border border-gray-200 p-3">
              <h3 className="mb-2 font-bold text-orange-800">{node.data.name}</h3>

              <div className="mb-2 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="font-semibold">Primary Key: </span>
                  {keys.primaryKey.length === 0
                    ? "— (ninguna)"
                    : keys.primaryKey.map((a) => a.name).join(", ") + (keys.isCompositePK ? " (compuesta)" : "")}
                </div>
                <div>
                  <span className="font-semibold">Foreign Keys: </span>
                  {keys.foreignKeys.length === 0 ? "—" : keys.foreignKeys.map((a) => a.name).join(", ")}
                </div>
                <div>
                  <span className="font-semibold">Candidate/Alternate Keys: </span>
                  {keys.candidateKeys.length === 0 ? "—" : keys.candidateKeys.map((c) => c.label).join(", ")}
                </div>
                <div>
                  <span className="font-semibold">Partial Keys (débil): </span>
                  {keys.partialKeys.length === 0 ? "—" : keys.partialKeys.map((a) => a.name).join(", ")}
                </div>
              </div>

              {warnings.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs font-semibold text-red-700">Buenas prácticas:</p>
                  <ul className="ml-4 list-disc text-xs text-red-700">
                    {warnings.map((w, i) => (
                      <li key={i}>{w.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              {normalization.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold text-gray-700">Normalización:</p>
                  <ul className="ml-4 list-disc text-xs">
                    {normalization.map((issue, i) => (
                      <li
                        key={i}
                        className={issue.severity === "violation" ? "text-red-700" : "text-amber-700"}
                      >
                        <span className="font-mono">[{FORM_LABEL[issue.form]}]</span>{" "}
                        {issue.severity === "heuristic" && <em>(revisar) </em>}
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                warnings.length === 0 && <p className="text-xs text-green-700">✓ Sin avisos.</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
