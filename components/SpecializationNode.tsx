"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useDiagramStore } from "@/store/diagramStore";
import type { SpecializationData } from "@/types/diagram";

export default function SpecializationNode({ id, data }: NodeProps<SpecializationData>) {
  const toggleConstraint = useDiagramStore((s) => s.toggleSpecializationConstraint);
  const toggleCompleteness = useDiagramStore((s) => s.toggleSpecializationCompleteness);
  const updateDiscriminator = useDiagramStore((s) => s.updateSpecializationDiscriminator);

  const letter = data.constraint === "disjoint" ? "d" : "o";

  return (
    <div className="group relative flex h-14 w-14 flex-col items-center">
      {/* Entrada desde la superclase (arriba) */}
      <Handle type="target" position={Position.Top} id="super" />
      {/* Salidas hacia las subclases (abajo, izquierda, derecha) */}
      <Handle type="source" position={Position.Bottom} id="sub-bottom" />
      <Handle type="source" position={Position.Left} id="sub-left" />
      <Handle type="source" position={Position.Right} id="sub-right" />

      <div
        className={`flex h-14 w-14 items-center justify-center rounded-full bg-white text-lg font-bold shadow-md ${
          data.completeness === "total" ? "border-4 border-double border-gray-800" : "border-2 border-gray-800"
        }`}
        title={
          data.constraint === "disjoint"
            ? "Disjoint: una instancia pertenece a UNA sola subclase (ej. Vehículo → Auto XOR Moto)"
            : "Overlapping: una instancia puede pertenecer a varias subclases a la vez (ej. Persona → Estudiante Y Empleado)"
        }
        onClick={() => toggleConstraint(id)}
      >
        {letter}
      </div>

      <input
        className="mt-1 w-20 bg-transparent text-center text-[9px] text-gray-600 outline-none"
        placeholder="discriminador"
        value={data.discriminator ?? ""}
        onChange={(e) => updateDiscriminator(id, e.target.value)}
      />

      <button
        className="absolute -bottom-4 rounded bg-gray-700 px-1 text-[9px] text-white opacity-0 group-hover:opacity-100"
        title="Alternar completitud: total (línea doble, toda superclase debe tener subclase) / parcial"
        onClick={() => toggleCompleteness(id)}
      >
        {data.completeness === "total" ? "total" : "parcial"}
      </button>
    </div>
  );
}
