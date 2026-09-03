# DB Diagram Tool

Herramienta de modelado ER (entidad-relación), 100% frontend, construida con Next.js + React Flow.
Fase 1-3 del roadmap: crear entidades, atributos editables, marcar PK/FK, entidades fuerte/débil,
relaciones con cardinalidad y relación identificadora, export a JSON y a SQL (Postgres/MySQL/SQLite).

## Cómo correrlo

```bash
pnpm install
pnpm dev
```

Abrí http://localhost:3000

## Estructura

- `types/diagram.ts` — modelo de datos (Attribute, Entity, Relationship).
- `store/diagramStore.ts` — estado global con Zustand, integrado con los nodos/edges de React Flow.
- `components/EntityNode.tsx` — nodo custom: la "tabla" visual con sus atributos editables inline.
- `components/RelationshipEdge.tsx` — edge custom: línea con cardinalidad en ambos extremos y toggle de "relación identificadora".
- `components/Toolbar.tsx` — agregar entidad, exportar/importar JSON, exportar SQL.
- `components/DiagramCanvas.tsx` — arma todo con `<ReactFlow />`.
- `lib/sqlExport.ts` — generador de DDL puro (sin backend).

## Qué falta (siguientes fases, ver el spec original)

- Undo/redo (Zustand + historial de snapshots, o librería `zundo`).
- Persistencia en IndexedDB (autoguardado).
- Notación Chen (rombos) como alternativa a crow's foot.
- Selector de atributo referenciado al crear una FK (hoy el toggle FK no abre el picker de "a qué entidad/atributo apunta" — eso lo tenés que completar en `PropertiesPanel`, que todavía no está armado).
- Export a PNG/SVG (`html-to-image`).
- Reverse engineering: importar SQL existente y generar el diagrama.

## Notas

- El botón "FK" en cada atributo solo marca el flag visualmente por ahora; falta conectar
  el picker de `attribute.references` (entityId + attributeId) a una UI — es el próximo paso lógico.
- Todo el estado vive en memoria (Zustand) + lo que exportes a `.json` manualmente. No hay
  autoguardado todavía.
