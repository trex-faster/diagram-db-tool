"use client";

import { validateIdentifier } from "@/lib/naming";

export default function NameField({
  value,
  onChange,
  kind,
  className,
  displayValue,
  parseDisplayValue,
}: {
  value: string;
  onChange: (name: string) => void;
  kind: "entidad" | "atributo";
  className?: string;
  /** Si se pasa, se muestra esto en el input en vez de `value` (ej. "{telefono}" para multivaluados). */
  displayValue?: string;
  /** Si se pasa junto con displayValue, convierte lo que el usuario tipeó de vuelta al nombre real. */
  parseDisplayValue?: (raw: string) => string;
}) {
  const validation = validateIdentifier(value, kind);

  return (
    <span className="relative inline-flex items-center gap-0.5">
      <input
        className={`${className ?? ""} ${
          !validation.valid ? "outline outline-1 outline-red-500" : ""
        }`}
        value={displayValue ?? value}
        onChange={(e) => onChange(parseDisplayValue ? parseDisplayValue(e.target.value) : e.target.value)}
        title={!validation.valid ? validation.reason : undefined}
      />
      {!validation.valid && validation.suggestion && (
        <button
          type="button"
          title={`Corregir a "${validation.suggestion}" — ${validation.reason}`}
          className="shrink-0 text-[9px] font-bold text-red-600 hover:underline"
          onClick={() => onChange(validation.suggestion!)}
        >
          ⚠fix
        </button>
      )}
    </span>
  );
}
