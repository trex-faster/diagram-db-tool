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
  opts: { isAssociative?: boolean; kind?: "strong" | "weak" } = {}
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
      kind: opts.kind ?? "strong",
      isAssociative: opts.isAssociative ?? false,
      attributes: attrsWithIds,
      indexes: fkIndexes,
    },
  };
}

/** Atributo COMPUESTO + sus sub-atributos, listos para spread en la lista de attributes de una entidad. */
function mkComposite(name: string, subFields: Array<Partial<Attribute> & Pick<Attribute, "name">>): Attribute[] {
  const parent = mkAttr({ name, isComposite: true });
  const children = subFields.map((spec) => mkAttr({ type: "varchar", length: 255, ...spec, parentAttributeId: parent.id }));
  return [parent, ...children];
}

function mkEdge(
  source: Node<EntityData>,
  target: Node<EntityData>,
  sourceCardinality: "1" | "N",
  targetCardinality: "1" | "N",
  name: string,
  materializedFkAttrId?: string,
  isIdentifying = false
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
      isIdentifying,
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

/**
 * CRM profesional completo — el "flagship": usa deliberadamente TODO lo que la herramienta
 * sabe modelar, en un esquema real de la vida real (al estilo Salesforce/HubSpot simplificado).
 *
 *   - Multi-tenancy: tenant_id en cada tabla de negocio + índices compuestos (tenant_id, X)
 *     para unicidad *dentro* de cada tenant (dos tenants SÍ pueden tener un rol "Admin" cada uno).
 *   - RBAC: users / roles / permissions con sus 2 tablas de unión M:N.
 *   - Jerarquías (relación reflexiva): users.manager_id (organigrama) y
 *     accounts.parent_account_id (empresa matriz / subsidiarias).
 *   - Entidades débiles + llave parcial: contact_phones (depende de contacts) y
 *     order_line_items (depende de orders) — ninguna tiene sentido de existir sin su dueño.
 *   - Atributo compuesto: accounts.billing_address = calle + ciudad + estado + CP + país.
 *   - Atributo derivado: opportunities.expected_revenue (= amount × probability — se calcula,
 *     no se guarda).
 *   - Entidad asociativa con atributos propios: opportunity_products (cantidad, precio unitario,
 *     descuento — no es solo una tabla de unión vacía).
 *   - Relaciones polimórficas: activities, notes y taggables pueden apuntar a Lead, Contact,
 *     Account U Opportunity sin una FK fija.
 *   - Candidate/Alternate keys: products (tenant_id + sku) y roles (tenant_id + name) son
 *     únicas dentro del tenant sin ser la PK.
 *   - Auditoría: audit_logs con columna JSON para el diff de cada cambio + FK polimórfica
 *     hacia CUALQUIER entidad auditable.
 *   - Lookups clásicos: lead_statuses y pipeline_stages en vez de strings sueltos.
 */
function buildCrmTemplate() {
  // ---------- Multi-tenancy + RBAC ----------
  const tenants = mkEntity("tenants", { x: 0, y: 0 }, [
    mkAttr({ name: "id", isPrimaryKey: true }),
    mkAttr({ name: "name", type: "varchar", length: 255 }),
    mkAttr({ name: "subdomain", type: "varchar", length: 100, isUnique: true, keyNature: "natural" }),
    mkAttr({ name: "created_at", type: "datetime" }),
  ]);

  const usersIdPlaceholder = mkAttr({ name: "id", isPrimaryKey: true });
  const usersTenantFk = mkAttr({
    name: "tenant_id",
    isForeignKey: true,
    references: { entityId: tenants.id, attributeId: tenants.data.attributes[0].id },
  });
  const usersManagerFk = mkAttr({
    name: "manager_id",
    nullable: true, // el dueño de la cuenta / gerente general no tiene manager
    isForeignKey: true,
  });
  const users = mkEntity("users", { x: 350, y: 0 }, [
    usersIdPlaceholder,
    usersTenantFk,
    mkAttr({ name: "email", type: "varchar", length: 255, isUnique: true, keyNature: "natural" }),
    mkAttr({ name: "first_name", type: "varchar", length: 100 }),
    mkAttr({ name: "last_name", type: "varchar", length: 100 }),
    usersManagerFk,
    mkAttr({ name: "is_active", type: "boolean" }),
  ]);
  // manager_id es reflexiva (self-reference). mkEntity() clona los atributos al crear el nodo,
  // así que para setear la auto-referencia hay que mutar la COPIA guardada en users.data.attributes,
  // no la variable local usersManagerFk (que ya quedó desconectada del array real).
  const managerAttrInStore = users.data.attributes.find((a) => a.id === usersManagerFk.id)!;
  managerAttrInStore.references = { entityId: users.id, attributeId: usersIdPlaceholder.id };

  const rolesTenantFk = mkAttr({
    name: "tenant_id",
    isForeignKey: true,
    references: { entityId: tenants.id, attributeId: tenants.data.attributes[0].id },
  });
  const roles = mkEntity("roles", { x: 700, y: 0 }, [
    mkAttr({ name: "id", isPrimaryKey: true }),
    rolesTenantFk,
    mkAttr({ name: "name", type: "varchar", length: 100 }),
  ]);
  // Candidate/Alternate key: "name" no es único global, pero SÍ dentro del tenant.
  roles.data.indexes.push({
    id: uuid(),
    name: "uq_roles_tenant_name",
    attributeIds: [rolesTenantFk.id, roles.data.attributes[2].id],
    isUnique: true,
  });

  const permissions = mkEntity("permissions", { x: 1050, y: 0 }, [
    mkAttr({ name: "id", isPrimaryKey: true }),
    mkAttr({ name: "name", type: "varchar", length: 100, isUnique: true }), // ej. "leads.create"
  ]);

  const userRolesUserFk = mkAttr({
    name: "user_id",
    isPrimaryKey: true,
    isForeignKey: true,
    references: { entityId: users.id, attributeId: usersIdPlaceholder.id },
  });
  const userRolesRoleFk = mkAttr({
    name: "role_id",
    isPrimaryKey: true,
    isForeignKey: true,
    references: { entityId: roles.id, attributeId: roles.data.attributes[0].id },
  });
  const userRoles = mkEntity("user_roles", { x: 350, y: 220 }, [userRolesUserFk, userRolesRoleFk], {
    isAssociative: true,
  });

  const rolePermRoleFk = mkAttr({
    name: "role_id",
    isPrimaryKey: true,
    isForeignKey: true,
    references: { entityId: roles.id, attributeId: roles.data.attributes[0].id },
  });
  const rolePermPermFk = mkAttr({
    name: "permission_id",
    isPrimaryKey: true,
    isForeignKey: true,
    references: { entityId: permissions.id, attributeId: permissions.data.attributes[0].id },
  });
  const rolePermissions = mkEntity("role_permissions", { x: 700, y: 220 }, [rolePermRoleFk, rolePermPermFk], {
    isAssociative: true,
  });

  // ---------- Accounts / Contacts ----------
  const accountsIdPlaceholder = mkAttr({ name: "id", isPrimaryKey: true });
  const accountsTenantFk = mkAttr({
    name: "tenant_id",
    isForeignKey: true,
    references: { entityId: tenants.id, attributeId: tenants.data.attributes[0].id },
  });
  const accountsOwnerFk = mkAttr({
    name: "owner_user_id",
    isForeignKey: true,
    references: { entityId: users.id, attributeId: usersIdPlaceholder.id },
  });
  const accountsParentFk = mkAttr({
    name: "parent_account_id",
    nullable: true, // solo las subsidiarias tienen empresa matriz
    isForeignKey: true,
  });
  const accounts = mkEntity("accounts", { x: 1050, y: 220 }, [
    accountsIdPlaceholder,
    accountsTenantFk,
    accountsOwnerFk,
    accountsParentFk,
    mkAttr({ name: "name", type: "varchar", length: 255 }),
    mkAttr({ name: "industry", type: "varchar", length: 100, nullable: true }),
    mkAttr({ name: "website", type: "varchar", length: 255, nullable: true }),
    // Atributo COMPUESTO — la dirección de facturación como conjunto de sub-atributos.
    ...mkComposite("billing_address", [
      { name: "street" },
      { name: "city" },
      { name: "state" },
      { name: "postal_code", length: 20 },
      { name: "country", length: 100 },
    ]),
  ]);
  const parentAttrInStore = accounts.data.attributes.find((a) => a.id === accountsParentFk.id)!;
  parentAttrInStore.references = { entityId: accounts.id, attributeId: accountsIdPlaceholder.id }; // reflexiva

  const contactsIdPlaceholder = mkAttr({ name: "id", isPrimaryKey: true });
  const contactsTenantFk = mkAttr({
    name: "tenant_id",
    isForeignKey: true,
    references: { entityId: tenants.id, attributeId: tenants.data.attributes[0].id },
  });
  const contactsAccountFk = mkAttr({
    name: "account_id",
    nullable: true, // un contacto puede existir todavía sin empresa asociada
    isForeignKey: true,
    references: { entityId: accounts.id, attributeId: accountsIdPlaceholder.id },
  });
  const contacts = mkEntity("contacts", { x: 0, y: 440 }, [
    contactsIdPlaceholder,
    contactsTenantFk,
    contactsAccountFk,
    mkAttr({ name: "first_name", type: "varchar", length: 100 }),
    mkAttr({ name: "last_name", type: "varchar", length: 100 }),
    mkAttr({ name: "email", type: "varchar", length: 255, nullable: true }),
  ]);

  // Entidad DÉBIL: un teléfono no existe sin su contacto. La llave parcial es "phone_type"
  // (mobile/work/home) — junto con contact_id identifica de forma única cada fila.
  const contactPhonesContactFk = mkAttr({
    name: "contact_id",
    isForeignKey: true,
    references: { entityId: contacts.id, attributeId: contactsIdPlaceholder.id },
  });
  const contactPhones = mkEntity(
    "contact_phones",
    { x: 300, y: 440 },
    [
      mkAttr({ name: "id", isPrimaryKey: true }),
      contactPhonesContactFk,
      mkAttr({ name: "phone_type", type: "varchar", length: 20, isPartialKey: true }), // mobile/work/home
      mkAttr({ name: "phone_number", type: "varchar", length: 30 }),
    ],
    { kind: "weak" }
  );

  // ---------- Leads ----------
  const leadStatuses = mkEntity("lead_statuses", { x: 600, y: 440 }, [
    mkAttr({ name: "id", isPrimaryKey: true }),
    mkAttr({ name: "name", type: "varchar", length: 50, isUnique: true }), // New, Qualified, Converted...
    mkAttr({ name: "is_converted", type: "boolean" }),
  ]);

  const leads = mkEntity("leads", { x: 900, y: 440 }, [
    mkAttr({ name: "id", isPrimaryKey: true }),
    mkAttr({
      name: "tenant_id",
      isForeignKey: true,
      references: { entityId: tenants.id, attributeId: tenants.data.attributes[0].id },
    }),
    mkAttr({ name: "first_name", type: "varchar", length: 100 }),
    mkAttr({ name: "last_name", type: "varchar", length: 100 }),
    mkAttr({ name: "email", type: "varchar", length: 255 }),
    mkAttr({
      name: "status_id",
      isForeignKey: true,
      references: { entityId: leadStatuses.id, attributeId: leadStatuses.data.attributes[0].id },
    }),
    mkAttr({
      name: "owner_user_id",
      isForeignKey: true,
      references: { entityId: users.id, attributeId: usersIdPlaceholder.id },
    }),
    mkAttr({
      name: "converted_contact_id",
      nullable: true,
      isForeignKey: true,
      references: { entityId: contacts.id, attributeId: contactsIdPlaceholder.id },
    }),
  ]);

  // ---------- Pipeline / Oportunidades ----------
  const pipelines = mkEntity("pipelines", { x: 1200, y: 440 }, [
    mkAttr({ name: "id", isPrimaryKey: true }),
    mkAttr({
      name: "tenant_id",
      isForeignKey: true,
      references: { entityId: tenants.id, attributeId: tenants.data.attributes[0].id },
    }),
    mkAttr({ name: "name", type: "varchar", length: 100 }),
  ]);

  const pipelineStagesPipelineFk = mkAttr({
    name: "pipeline_id",
    isForeignKey: true,
    references: { entityId: pipelines.id, attributeId: pipelines.data.attributes[0].id },
  });
  const pipelineStages = mkEntity("pipeline_stages", { x: 0, y: 660 }, [
    mkAttr({ name: "id", isPrimaryKey: true }),
    pipelineStagesPipelineFk,
    mkAttr({ name: "name", type: "varchar", length: 100 }),
    mkAttr({ name: "display_order", type: "integer" }),
    mkAttr({ name: "probability", type: "decimal", precision: 5, scale: 2 }), // 0.00 a 100.00
  ]);

  const opportunitiesStageFk = mkAttr({
    name: "pipeline_stage_id",
    isForeignKey: true,
    references: { entityId: pipelineStages.id, attributeId: pipelineStages.data.attributes[0].id },
  });
  const opportunities = mkEntity("opportunities", { x: 300, y: 660 }, [
    mkAttr({ name: "id", isPrimaryKey: true }),
    mkAttr({
      name: "tenant_id",
      isForeignKey: true,
      references: { entityId: tenants.id, attributeId: tenants.data.attributes[0].id },
    }),
    mkAttr({
      name: "account_id",
      isForeignKey: true,
      references: { entityId: accounts.id, attributeId: accountsIdPlaceholder.id },
    }),
    mkAttr({
      name: "contact_id",
      nullable: true,
      isForeignKey: true,
      references: { entityId: contacts.id, attributeId: contactsIdPlaceholder.id },
    }),
    mkAttr({
      name: "owner_user_id",
      isForeignKey: true,
      references: { entityId: users.id, attributeId: usersIdPlaceholder.id },
    }),
    opportunitiesStageFk,
    mkAttr({ name: "name", type: "varchar", length: 255 }),
    mkAttr({ name: "amount", type: "decimal", precision: 12, scale: 2 }),
    mkAttr({ name: "probability", type: "decimal", precision: 5, scale: 2 }),
    // Atributo DERIVADO — no se guarda, se calcula (amount × probability).
    mkAttr({ name: "expected_revenue", type: "decimal", precision: 12, scale: 2, isDerived: true }),
    mkAttr({ name: "close_date", type: "date" }),
    mkAttr({ name: "is_closed", type: "boolean" }),
    mkAttr({ name: "is_won", type: "boolean" }),
  ]);

  // ---------- Productos + línea de oportunidad (asociativa CON atributos) ----------
  const productsTenantFk = mkAttr({
    name: "tenant_id",
    isForeignKey: true,
    references: { entityId: tenants.id, attributeId: tenants.data.attributes[0].id },
  });
  const products = mkEntity("products", { x: 600, y: 660 }, [
    mkAttr({ name: "id", isPrimaryKey: true }),
    productsTenantFk,
    mkAttr({ name: "sku", type: "varchar", length: 50 }),
    mkAttr({ name: "name", type: "varchar", length: 255 }),
    mkAttr({ name: "price", type: "decimal", precision: 12, scale: 2 }),
    mkAttr({ name: "is_active", type: "boolean" }),
  ]);
  // Candidate/Alternate key: el SKU es único DENTRO del tenant, no globalmente.
  products.data.indexes.push({
    id: uuid(),
    name: "uq_products_tenant_sku",
    attributeIds: [productsTenantFk.id, products.data.attributes[2].id],
    isUnique: true,
  });

  const oppProductsOppFk = mkAttr({
    name: "opportunity_id",
    isPrimaryKey: true,
    isForeignKey: true,
    references: { entityId: opportunities.id, attributeId: opportunities.data.attributes[0].id },
  });
  const oppProductsProductFk = mkAttr({
    name: "product_id",
    isPrimaryKey: true,
    isForeignKey: true,
    references: { entityId: products.id, attributeId: products.data.attributes[0].id },
  });
  const opportunityProducts = mkEntity(
    "opportunity_products",
    { x: 900, y: 660 },
    [
      oppProductsOppFk,
      oppProductsProductFk,
      // Esto es lo que distingue una entidad ASOCIATIVA real de una simple tabla de unión:
      // tiene atributos propios que no pertenecen ni a Oportunidad ni a Producto.
      mkAttr({ name: "quantity", type: "integer" }),
      mkAttr({ name: "unit_price", type: "decimal", precision: 12, scale: 2 }),
      mkAttr({ name: "discount_percent", type: "decimal", precision: 5, scale: 2, nullable: true }),
    ],
    { isAssociative: true }
  );

  // ---------- Orders / Line Items / Invoices / Payments ----------
  const ordersIdPlaceholder = mkAttr({ name: "id", isPrimaryKey: true });
  const orders = mkEntity("orders", { x: 1200, y: 660 }, [
    ordersIdPlaceholder,
    mkAttr({
      name: "tenant_id",
      isForeignKey: true,
      references: { entityId: tenants.id, attributeId: tenants.data.attributes[0].id },
    }),
    mkAttr({
      name: "account_id",
      isForeignKey: true,
      references: { entityId: accounts.id, attributeId: accountsIdPlaceholder.id },
    }),
    mkAttr({ name: "order_number", type: "varchar", length: 50 }),
    mkAttr({ name: "status", type: "varchar", length: 30 }),
    mkAttr({ name: "order_date", type: "date" }),
  ]);

  // Otra entidad DÉBIL: una línea de pedido no tiene sentido sin su pedido. Llave parcial:
  // "line_number" (1, 2, 3... dentro de CADA pedido).
  const orderLineItemsOrderFk = mkAttr({
    name: "order_id",
    isForeignKey: true,
    references: { entityId: orders.id, attributeId: ordersIdPlaceholder.id },
  });
  const orderLineItems = mkEntity(
    "order_line_items",
    { x: 0, y: 880 },
    [
      mkAttr({ name: "id", isPrimaryKey: true }),
      orderLineItemsOrderFk,
      mkAttr({ name: "line_number", type: "integer", isPartialKey: true }),
      mkAttr({
        name: "product_id",
        isForeignKey: true,
        references: { entityId: products.id, attributeId: products.data.attributes[0].id },
      }),
      mkAttr({ name: "quantity", type: "integer" }),
      mkAttr({ name: "unit_price", type: "decimal", precision: 12, scale: 2 }),
    ],
    { kind: "weak" }
  );

  const invoicesIdPlaceholder = mkAttr({ name: "id", isPrimaryKey: true });
  const invoices = mkEntity("invoices", { x: 300, y: 880 }, [
    invoicesIdPlaceholder,
    mkAttr({
      name: "tenant_id",
      isForeignKey: true,
      references: { entityId: tenants.id, attributeId: tenants.data.attributes[0].id },
    }),
    mkAttr({
      name: "order_id",
      isForeignKey: true,
      references: { entityId: orders.id, attributeId: ordersIdPlaceholder.id },
    }),
    mkAttr({ name: "invoice_number", type: "varchar", length: 50 }),
    mkAttr({ name: "issue_date", type: "date" }),
    mkAttr({ name: "due_date", type: "date" }),
    mkAttr({ name: "status", type: "varchar", length: 30 }),
  ]);

  const payments = mkEntity("payments", { x: 600, y: 880 }, [
    mkAttr({ name: "id", isPrimaryKey: true }),
    mkAttr({
      name: "tenant_id",
      isForeignKey: true,
      references: { entityId: tenants.id, attributeId: tenants.data.attributes[0].id },
    }),
    mkAttr({
      name: "invoice_id",
      isForeignKey: true,
      references: { entityId: invoices.id, attributeId: invoicesIdPlaceholder.id },
    }),
    mkAttr({ name: "amount", type: "decimal", precision: 12, scale: 2 }),
    mkAttr({ name: "paid_at", type: "datetime" }),
    mkAttr({ name: "method", type: "varchar", length: 30 }),
  ]);

  // ---------- Polimórficas: Activities, Notes, Tags, Audit ----------
  const activitiesTargetId = mkAttr({ name: "activityable_id", polymorphicGroup: "activityable", polymorphicRole: "id" });
  const activitiesTargetType = mkAttr({
    name: "activityable_type",
    type: "varchar",
    length: 50,
    polymorphicGroup: "activityable",
    polymorphicRole: "type",
  });
  const activities = mkEntity("activities", { x: 900, y: 880 }, [
    mkAttr({ name: "id", isPrimaryKey: true }),
    mkAttr({
      name: "tenant_id",
      isForeignKey: true,
      references: { entityId: tenants.id, attributeId: tenants.data.attributes[0].id },
    }),
    mkAttr({
      name: "owner_user_id",
      isForeignKey: true,
      references: { entityId: users.id, attributeId: usersIdPlaceholder.id },
    }),
    mkAttr({ name: "type", type: "varchar", length: 20 }), // call/email/meeting
    mkAttr({ name: "subject", type: "varchar", length: 255 }),
    mkAttr({ name: "activity_date", type: "datetime" }),
    activitiesTargetId,
    activitiesTargetType,
  ]);
  activities.data.indexes.push({
    id: uuid(),
    name: "idx_activities_activityable",
    attributeIds: [activitiesTargetId.id, activitiesTargetType.id],
    isUnique: false,
  });

  const notesTargetId = mkAttr({ name: "noteable_id", polymorphicGroup: "noteable", polymorphicRole: "id" });
  const notesTargetType = mkAttr({
    name: "noteable_type",
    type: "varchar",
    length: 50,
    polymorphicGroup: "noteable",
    polymorphicRole: "type",
  });
  const notes = mkEntity("notes", { x: 1200, y: 880 }, [
    mkAttr({ name: "id", isPrimaryKey: true }),
    mkAttr({
      name: "tenant_id",
      isForeignKey: true,
      references: { entityId: tenants.id, attributeId: tenants.data.attributes[0].id },
    }),
    mkAttr({
      name: "author_user_id",
      isForeignKey: true,
      references: { entityId: users.id, attributeId: usersIdPlaceholder.id },
    }),
    mkAttr({ name: "body", type: "text" }),
    notesTargetId,
    notesTargetType,
  ]);
  notes.data.indexes.push({
    id: uuid(),
    name: "idx_notes_noteable",
    attributeIds: [notesTargetId.id, notesTargetType.id],
    isUnique: false,
  });

  const tagsTenantFk = mkAttr({
    name: "tenant_id",
    isForeignKey: true,
    references: { entityId: tenants.id, attributeId: tenants.data.attributes[0].id },
  });
  const tags = mkEntity("tags", { x: 0, y: 1100 }, [
    mkAttr({ name: "id", isPrimaryKey: true }),
    tagsTenantFk,
    mkAttr({ name: "name", type: "varchar", length: 50 }),
  ]);
  tags.data.indexes.push({
    id: uuid(),
    name: "uq_tags_tenant_name",
    attributeIds: [tagsTenantFk.id, tags.data.attributes[2].id],
    isUnique: true,
  });

  const taggablesTagFk = mkAttr({
    name: "tag_id",
    isPrimaryKey: true,
    isForeignKey: true,
    references: { entityId: tags.id, attributeId: tags.data.attributes[0].id },
  });
  const taggablesTargetId = mkAttr({
    name: "taggable_id",
    isPrimaryKey: true,
    polymorphicGroup: "taggable",
    polymorphicRole: "id",
  });
  const taggablesTargetType = mkAttr({
    name: "taggable_type",
    type: "varchar",
    length: 50,
    isPrimaryKey: true,
    polymorphicGroup: "taggable",
    polymorphicRole: "type",
  });
  const taggables = mkEntity(
    "taggables",
    { x: 300, y: 1100 },
    [taggablesTagFk, taggablesTargetId, taggablesTargetType],
    { isAssociative: true }
  );

  const auditTargetId = mkAttr({ name: "auditable_id", polymorphicGroup: "auditable", polymorphicRole: "id" });
  const auditTargetType = mkAttr({
    name: "auditable_type",
    type: "varchar",
    length: 50,
    polymorphicGroup: "auditable",
    polymorphicRole: "type",
  });
  const auditLogs = mkEntity("audit_logs", { x: 600, y: 1100 }, [
    mkAttr({ name: "id", isPrimaryKey: true }),
    mkAttr({
      name: "tenant_id",
      isForeignKey: true,
      references: { entityId: tenants.id, attributeId: tenants.data.attributes[0].id },
    }),
    mkAttr({
      name: "user_id",
      nullable: true, // acciones automáticas del sistema no tienen usuario
      isForeignKey: true,
      references: { entityId: users.id, attributeId: usersIdPlaceholder.id },
    }),
    mkAttr({ name: "action", type: "varchar", length: 20 }), // create/update/delete
    mkAttr({ name: "changes", type: "json" }), // diff antes/después
    mkAttr({ name: "created_at", type: "datetime" }),
    auditTargetId,
    auditTargetType,
  ]);
  auditLogs.data.indexes.push({
    id: uuid(),
    name: "idx_audit_logs_auditable",
    attributeIds: [auditTargetId.id, auditTargetType.id],
    isUnique: false,
  });

  return {
    name: "CRM profesional completo",
    nodes: [
      tenants,
      users,
      roles,
      permissions,
      userRoles,
      rolePermissions,
      accounts,
      contacts,
      contactPhones,
      leadStatuses,
      leads,
      pipelines,
      pipelineStages,
      opportunities,
      products,
      opportunityProducts,
      orders,
      orderLineItems,
      invoices,
      payments,
      activities,
      notes,
      tags,
      taggables,
      auditLogs,
    ],
    edges: [
      mkEdge(tenants, users, "1", "N", "tiene", usersTenantFk.id),
      mkEdge(users, users, "1", "N", "gerencia", usersManagerFk.id),
      mkEdge(tenants, roles, "1", "N", "tiene", rolesTenantFk.id),
      mkEdge(users, userRoles, "1", "N", "tiene", userRolesUserFk.id),
      mkEdge(roles, userRoles, "1", "N", "asignado_a", userRolesRoleFk.id),
      mkEdge(roles, rolePermissions, "1", "N", "tiene", rolePermRoleFk.id),
      mkEdge(permissions, rolePermissions, "1", "N", "otorgado_en", rolePermPermFk.id),
      mkEdge(tenants, accounts, "1", "N", "tiene", accountsTenantFk.id),
      mkEdge(users, accounts, "1", "N", "es_dueño_de", accountsOwnerFk.id),
      mkEdge(accounts, accounts, "1", "N", "tiene_subsidiaria", accountsParentFk.id),
      mkEdge(tenants, contacts, "1", "N", "tiene", contactsTenantFk.id),
      mkEdge(accounts, contacts, "1", "N", "emplea", contactsAccountFk.id),
      mkEdge(contacts, contactPhones, "1", "N", "tiene", contactPhonesContactFk.id, true),
      mkEdge(tenants, leads, "1", "N", "tiene", leads.data.attributes[1].id),
      mkEdge(leadStatuses, leads, "1", "N", "clasifica", leads.data.attributes[5].id),
      mkEdge(users, leads, "1", "N", "es_dueño_de", leads.data.attributes[6].id),
      mkEdge(contacts, leads, "1", "N", "se_convirtio_en", leads.data.attributes[7].id),
      mkEdge(tenants, pipelines, "1", "N", "tiene", pipelines.data.attributes[1].id),
      mkEdge(pipelines, pipelineStages, "1", "N", "tiene", pipelineStagesPipelineFk.id, true),
      mkEdge(tenants, opportunities, "1", "N", "tiene", opportunities.data.attributes[1].id),
      mkEdge(accounts, opportunities, "1", "N", "tiene", opportunities.data.attributes[2].id),
      mkEdge(contacts, opportunities, "1", "N", "involucrado_en", opportunities.data.attributes[3].id),
      mkEdge(users, opportunities, "1", "N", "es_dueño_de", opportunities.data.attributes[4].id),
      mkEdge(pipelineStages, opportunities, "1", "N", "clasifica", opportunitiesStageFk.id),
      mkEdge(tenants, products, "1", "N", "tiene", productsTenantFk.id),
      mkEdge(opportunities, opportunityProducts, "1", "N", "incluye", oppProductsOppFk.id),
      mkEdge(products, opportunityProducts, "1", "N", "aparece_en", oppProductsProductFk.id),
      mkEdge(tenants, orders, "1", "N", "tiene", orders.data.attributes[1].id),
      mkEdge(accounts, orders, "1", "N", "realiza", orders.data.attributes[2].id),
      mkEdge(orders, orderLineItems, "1", "N", "tiene", orderLineItemsOrderFk.id, true),
      mkEdge(products, orderLineItems, "1", "N", "aparece_en", orderLineItems.data.attributes[3].id),
      mkEdge(tenants, invoices, "1", "N", "tiene", invoices.data.attributes[1].id),
      mkEdge(orders, invoices, "1", "N", "genera", invoices.data.attributes[2].id),
      mkEdge(tenants, payments, "1", "N", "tiene", payments.data.attributes[1].id),
      mkEdge(invoices, payments, "1", "N", "recibe", payments.data.attributes[2].id),
      mkEdge(tenants, activities, "1", "N", "tiene", activities.data.attributes[1].id),
      mkEdge(users, activities, "1", "N", "realiza", activities.data.attributes[2].id),
      mkEdge(tenants, notes, "1", "N", "tiene", notes.data.attributes[1].id),
      mkEdge(users, notes, "1", "N", "escribe", notes.data.attributes[2].id),
      mkEdge(tenants, tags, "1", "N", "tiene", tagsTenantFk.id),
      mkEdge(tags, taggables, "1", "N", "etiqueta", taggablesTagFk.id),
      mkEdge(tenants, auditLogs, "1", "N", "tiene", auditLogs.data.attributes[1].id),
      mkEdge(users, auditLogs, "1", "N", "realiza", auditLogs.data.attributes[2].id),
    ],
  };
}

export const TEMPLATES: DiagramTemplate[] = [
  {
    id: "crm-advanced",
    label: "🏆 CRM profesional completo",
    description:
      "25 entidades: multi-tenancy, RBAC, jerarquías, entidades débiles, polimorfismo, atributos compuestos/derivados, entidad asociativa y auditoría — todo lo que sabe modelar la herramienta, en un esquema real.",
    build: buildCrmTemplate,
  },
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
