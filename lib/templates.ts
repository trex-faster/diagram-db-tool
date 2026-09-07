import type { Node, Edge } from "@xyflow/react";
import type { Attribute, DirectRelationshipData, EntityData } from "@/types/diagram";

const uuid = () => crypto.randomUUID();

function mkAttr(overrides: Partial<Attribute> & Pick<Attribute, "name">): Attribute {
  return {
    id: uuid(),
    type: "integer",
    nullable: false,
    isPrimaryKey: false,
    isForeignKey: false,
    isPartialKey: false,
    isUnique: false,
    isMultivalued: false,
    isDerived: false,
    isComposite: false,
    ...overrides,
  };
}

function mkEntity(
  name: string,
  position: { x: number; y: number },
  attributes: Attribute[],
  opts: { isAssociative?: boolean } = {}
): Node<EntityData> {
  const attrsWithIds = attributes.map((a) => ({ ...a, id: a.id ?? uuid() }));
  const fkIndexes = attrsWithIds
    .filter((a) => a.isForeignKey)
    .map((a) => ({ id: uuid(), name: `idx_${name}_${a.name}`, attributeIds: [a.id], isUnique: false }));
  return {
    id: uuid(),
    type: "entity",
    position,
    data: {
      name,
      kind: "strong",
      isAssociative: opts.isAssociative ?? false,
      attributes: attrsWithIds,
      indexes: fkIndexes,
    },
  };
}

function mkEdge(
  source: Node<EntityData>,
  target: Node<EntityData>,
  sourceCardinality: "1" | "N",
  targetCardinality: "1" | "N",
  name: string,
  materializedFkAttrId?: string
): Edge<DirectRelationshipData> {
  return {
    id: uuid(),
    source: source.id,
    target: target.id,
    type: "direct",
    data: {
      name,
      sourceCardinality,
      targetCardinality,
      isIdentifying: false,
      ...(materializedFkAttrId
        ? { materializedFk: { entityId: target.id, attributeId: materializedFkAttrId } }
        : {}),
    },
  };
}

export interface DiagramTemplate {
  id: string;
  label: string;
  description: string;
  build: () => { name: string; nodes: Node<EntityData>[]; edges: Edge<DirectRelationshipData>[] };
}

/** RBAC: Usuarios + Roles + Permisos, con las 2 tablas intermedias M:N clásicas. */
function buildRbacTemplate() {
  const users = mkEntity("users", { x: 0, y: 0 }, [
    mkAttr({ name: "id", isPrimaryKey: true }),
    mkAttr({ name: "name", type: "varchar", length: 255 }),
    mkAttr({ name: "email", type: "varchar", length: 255, isUnique: true }),
  ]);
  const roles = mkEntity("roles", { x: 400, y: 0 }, [
    mkAttr({ name: "id", isPrimaryKey: true }),
    mkAttr({ name: "name", type: "varchar", length: 100, isUnique: true }),
  ]);
  const permissions = mkEntity("permissions", { x: 800, y: 0 }, [
    mkAttr({ name: "id", isPrimaryKey: true }),
    mkAttr({ name: "name", type: "varchar", length: 100, isUnique: true }),
  ]);

  const userIdFk = mkAttr({
    name: "user_id",
    isPrimaryKey: true,
    isForeignKey: true,
    references: { entityId: users.id, attributeId: users.data.attributes[0].id },
  });
  const roleIdFkA = mkAttr({
    name: "role_id",
    isPrimaryKey: true,
    isForeignKey: true,
    references: { entityId: roles.id, attributeId: roles.data.attributes[0].id },
  });
  const roleUser = mkEntity("role_user", { x: 200, y: 250 }, [userIdFk, roleIdFkA], { isAssociative: true });

  const roleIdFkB = mkAttr({
    name: "role_id",
    isPrimaryKey: true,
    isForeignKey: true,
    references: { entityId: roles.id, attributeId: roles.data.attributes[0].id },
  });
  const permissionIdFk = mkAttr({
    name: "permission_id",
    isPrimaryKey: true,
    isForeignKey: true,
    references: { entityId: permissions.id, attributeId: permissions.data.attributes[0].id },
  });
  const permissionRole = mkEntity("permission_role", { x: 600, y: 250 }, [roleIdFkB, permissionIdFk], {
    isAssociative: true,
  });

  return {
    name: "RBAC — Usuarios, Roles y Permisos",
    nodes: [users, roles, permissions, roleUser, permissionRole],
    edges: [
      mkEdge(users, roleUser, "1", "N", "tiene", userIdFk.id),
      mkEdge(roles, roleUser, "1", "N", "asignado_a", roleIdFkA.id),
      mkEdge(roles, permissionRole, "1", "N", "tiene", roleIdFkB.id),
      mkEdge(permissions, permissionRole, "1", "N", "otorgado_en", permissionIdFk.id),
    ],
  };
}

/** Categorías jerárquicas: relación reflexiva parent_id -> la misma entidad (árbol). */
function buildHierarchicalCategoriesTemplate() {
  const categories = mkEntity("categories", { x: 200, y: 0 }, [
    mkAttr({ name: "id", isPrimaryKey: true }),
    mkAttr({ name: "name", type: "varchar", length: 150 }),
    mkAttr({ name: "slug", type: "varchar", length: 150, isUnique: true }),
  ]);
  const parentFk = mkAttr({
    name: "parent_id",
    nullable: true, // las categorías raíz no tienen padre
    isForeignKey: true,
    references: { entityId: categories.id, attributeId: categories.data.attributes[0].id },
  });
  categories.data.attributes.push(parentFk);
  categories.data.indexes.push({
    id: uuid(),
    name: "idx_categories_parent_id",
    attributeIds: [parentFk.id],
    isUnique: false,
  });

  return {
    name: "Categorías jerárquicas (árbol)",
    nodes: [categories],
    edges: [mkEdge(categories, categories, "1", "N", "tiene_subcategoria", parentFk.id)],
  };
}

/** Comentarios y Likes polimórficos: pueden aplicar a un Post O a una Foto sin una sola FK fija. */
function buildPolymorphicTemplate() {
  const posts = mkEntity("posts", { x: 0, y: 0 }, [
    mkAttr({ name: "id", isPrimaryKey: true }),
    mkAttr({ name: "title", type: "varchar", length: 255 }),
  ]);
  const photos = mkEntity("photos", { x: 300, y: 0 }, [
    mkAttr({ name: "id", isPrimaryKey: true }),
    mkAttr({ name: "url", type: "varchar", length: 500 }),
  ]);

  const commentableId = mkAttr({ name: "commentable_id", polymorphicGroup: "commentable", polymorphicRole: "id" });
  const commentableType = mkAttr({
    name: "commentable_type",
    type: "varchar",
    length: 255,
    polymorphicGroup: "commentable",
    polymorphicRole: "type",
  });
  const comments = mkEntity("comments", { x: 150, y: 250 }, [
    mkAttr({ name: "id", isPrimaryKey: true }),
    mkAttr({ name: "body", type: "text" }),
    commentableId,
    commentableType,
  ]);
  comments.data.indexes.push({
    id: uuid(),
    name: "idx_comments_commentable",
    attributeIds: [commentableId.id, commentableType.id],
    isUnique: false,
  });

  const likeableId = mkAttr({ name: "likeable_id", polymorphicGroup: "likeable", polymorphicRole: "id" });
  const likeableType = mkAttr({
    name: "likeable_type",
    type: "varchar",
    length: 255,
    polymorphicGroup: "likeable",
    polymorphicRole: "type",
  });
  const likes = mkEntity("likes", { x: 450, y: 250 }, [
    mkAttr({ name: "id", isPrimaryKey: true }),
    likeableId,
    likeableType,
  ]);
  likes.data.indexes.push({
    id: uuid(),
    name: "idx_likes_likeable",
    attributeIds: [likeableId.id, likeableType.id],
    isUnique: false,
  });

  return {
    name: "Comentarios y Likes polimórficos",
    nodes: [posts, photos, comments, likes],
    edges: [], // el vínculo es polimórfico a propósito — no hay una sola FK fija que dibujar
  };
}

export const TEMPLATES: DiagramTemplate[] = [
  {
    id: "rbac",
    label: "RBAC (Usuarios, Roles, Permisos)",
    description: "M:N con tablas intermedias y PK compuesta — el patrón de control de acceso más común.",
    build: buildRbacTemplate,
  },
  {
    id: "hierarchical-categories",
    label: "Categorías jerárquicas",
    description: "Relación reflexiva (parent_id apuntando a la misma tabla) para modelar un árbol.",
    build: buildHierarchicalCategoriesTemplate,
  },
  {
    id: "polymorphic",
    label: "Comentarios y Likes polimórficos",
    description: "Patrón Rails/Laravel: {nombre}_id + {nombre}_type para apuntar a varias tablas distintas.",
    build: buildPolymorphicTemplate,
  },
];
