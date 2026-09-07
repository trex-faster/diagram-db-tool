/**
 * Reglas de nomenclatura que siguen la mayoría de los estilos de DB en el mundo real
 * (PostgreSQL/MySQL style guides, Rails/Django conventions): snake_case, minúsculas,
 * sin espacios, sin empezar con número, sin palabras reservadas de SQL.
 */

// Un subconjunto representativo de palabras reservadas ANSI SQL / muy comunes en
// Postgres/MySQL. No es exhaustivo (esa lista tiene cientos de entradas), pero cubre
// los errores más frecuentes de gente que recién arranca a modelar.
const SQL_RESERVED_WORDS = new Set([
  "select", "insert", "update", "delete", "from", "where", "join", "inner", "outer",
  "left", "right", "on", "as", "table", "column", "index", "key", "primary", "foreign",
  "references", "constraint", "unique", "not", "null", "default", "check", "order",
  "group", "by", "having", "union", "all", "distinct", "create", "alter", "drop",
  "grant", "revoke", "user", "role", "database", "schema", "view", "trigger",
  "procedure", "function", "return", "begin", "end", "if", "else", "case", "when",
  "then", "and", "or", "in", "exists", "between", "like", "is", "cast", "values",
  "into", "set", "limit", "offset", "with", "recursive", "cascade", "type",
]);

export interface NameValidation {
  valid: boolean;
  reason?: string;
  suggestion?: string;
}

/** Convierte cualquier texto a snake_case: "Nombre Cliente" / "nombreCliente" -> "nombre_cliente". */
export function toSnakeCase(input: string): string {
  return input
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2") // camelCase -> camel_Case
    .replace(/[\s\-]+/g, "_") // espacios/guiones -> guión bajo
    .replace(/[^a-zA-Z0-9_]/g, "") // saca acentos/símbolos raros
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

export function validateIdentifier(name: string, kind: "entidad" | "atributo" = "atributo"): NameValidation {
  const trimmed = name.trim();

  if (!trimmed) {
    return { valid: false, reason: `El nombre de ${kind} no puede estar vacío.` };
  }

  const snake = toSnakeCase(trimmed);

  if (/\s/.test(trimmed)) {
    return {
      valid: false,
      reason: "No se permiten espacios en nombres de tabla/columna.",
      suggestion: snake,
    };
  }

  if (/[A-Z]/.test(trimmed)) {
    return {
      valid: false,
      reason: "Se recomienda snake_case (minúsculas) en vez de mayúsculas/camelCase.",
      suggestion: snake,
    };
  }

  if (!/^[a-z_][a-z0-9_]*$/.test(trimmed)) {
    return {
      valid: false,
      reason: "Solo se permiten letras minúsculas, números y guión bajo, sin empezar con número.",
      suggestion: snake || `_${snake}`,
    };
  }

  if (SQL_RESERVED_WORDS.has(trimmed)) {
    return {
      valid: false,
      reason: `"${trimmed}" es una palabra reservada de SQL — puede romper tus queries.`,
      suggestion: `${trimmed}_`,
    };
  }

  if (trimmed.length > 63) {
    // Límite real de PostgreSQL para identificadores.
    return {
      valid: false,
      reason: "Más de 63 caracteres — PostgreSQL trunca los identificadores más largos.",
      suggestion: trimmed.slice(0, 63),
    };
  }

  return { valid: true };
}

/**
 * Singularización simple para generar nombres de FK/tabla intermedia (ej. "clientes" -> "cliente").
 * Heurística basada en el caso más común en español (vocal + "s": cliente/clientes,
 * producto/productos) y en inglés ("-ies" -> "-y": category/categories). No cubre el caso
 * español de consonante + "es" (color/colores, animal/animales) porque sin diccionario es
 * ambiguo distinguirlo del caso vocal+s — para esos nombres, el usuario puede corregir el
 * nombre de FK generado a mano.
 */
export function singularize(name: string): string {
  if (/[a-z]ies$/i.test(name)) return name.replace(/ies$/i, "y");
  if (/s$/i.test(name) && !/ss$/i.test(name)) return name.replace(/s$/i, "");
  return name;
}
