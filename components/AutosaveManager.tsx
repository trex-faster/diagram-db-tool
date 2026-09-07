"use client";

import { useEffect, useRef, useState } from "react";
import { useDiagramStore } from "@/store/diagramStore";
import { listDiagrams, loadDiagram, saveDiagram } from "@/lib/db";

const AUTOSAVE_DEBOUNCE_MS = 800;

export default function AutosaveManager() {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [ready, setReady] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadDone = useRef(false);

  // Carga el diagrama más reciente al montar (si existe alguno guardado).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const all = await listDiagrams();
        if (!cancelled && all.length > 0) {
          const latest = await loadDiagram(all[0].id);
          if (!cancelled && latest) {
            useDiagramStore.getState().loadSnapshot(
              { nodes: latest.nodes as never, edges: latest.edges as never },
              { id: latest.id, name: latest.name }
            );
          }
        }
      } catch {
        // Si IndexedDB no está disponible (modo privado, navegador viejo), seguimos
        // funcionando sin autoguardado en vez de romper la app.
        setStatus("error");
      } finally {
        if (!cancelled) {
          initialLoadDone.current = true;
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Autoguardado debounced en cada cambio estructural del diagrama.
  useEffect(() => {
    if (!ready) return;

    const unsubscribe = useDiagramStore.subscribe((state, prevState) => {
      if (!initialLoadDone.current) return;
      if (
        state.nodes === prevState.nodes &&
        state.edges === prevState.edges &&
        state.diagramName === prevState.diagramName
      ) {
        return;
      }

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        const { diagramId, diagramName, nodes, edges } = useDiagramStore.getState();
        setStatus("saving");
        try {
          await saveDiagram({
            id: diagramId,
            name: diagramName,
            nodes: nodes as never,
            edges: edges as never,
            updatedAt: new Date().toISOString(),
          });
          setStatus("saved");
        } catch {
          setStatus("error");
        }
      }, AUTOSAVE_DEBOUNCE_MS);
    });

    return () => unsubscribe();
  }, [ready]);

  if (status === "idle") return null;

  const label =
    status === "saving" ? "Guardando…" : status === "saved" ? "Guardado" : "No se pudo autoguardar";

  return (
    <div
      className={`pointer-events-none fixed bottom-3 right-3 z-30 rounded px-2 py-1 text-[10px] shadow ${
        status === "error" ? "bg-red-100 text-red-700" : "bg-white text-gray-500"
      }`}
    >
      {label}
    </div>
  );
}
