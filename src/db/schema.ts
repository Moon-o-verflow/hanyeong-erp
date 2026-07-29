import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  pgView,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

export const branches = pgTable("branches", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  branchName: varchar("branch_name", { length: 50 }).notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    loginId: varchar("login_id", { length: 50 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    userName: varchar("user_name", { length: 50 }).notNull(),
    role: varchar("role", { length: 20 }).notNull(),
    branchId: bigint("branch_id", { mode: "number" }).references(() => branches.id),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "users_role_check",
      sql`${table.role} in ('ADMIN', 'PURCHASER', 'WAREHOUSE', 'BRANCH')`,
    ),
    check(
      "users_branch_check",
      sql`(${table.role} = 'BRANCH' and ${table.branchId} is not null) or (${table.role} <> 'BRANCH' and ${table.branchId} is null)`,
    ),
  ],
);

export const items = pgTable(
  "items",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    itemCode: varchar("item_code", { length: 50 }).notNull().unique(),
    barcode: varchar("barcode", { length: 50 }),
    itemName: varchar("item_name", { length: 200 }).notNull(),
    categoryMajor: varchar("category_major", { length: 50 }),
    categoryMinor: varchar("category_minor", { length: 50 }),
    unitSpec: varchar("unit_spec", { length: 50 }),
    unitName: varchar("unit_name", { length: 20 }),
    packQty: integer("pack_qty").notNull().default(1),
    packUnit: varchar("pack_unit", { length: 20 }).notNull(),
    purchasePrice: integer("purchase_price").notNull(),
    supplyPrice: integer("supply_price").notNull(),
    minStockQty: integer("min_stock_qty"),
    remarks: text("remarks"),
    specRaw: varchar("spec_raw", { length: 200 }),
    isSpecParseFailed: boolean("is_spec_parse_failed").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("items_pack_qty_check", sql`${table.packQty} > 0`),
    check("items_purchase_price_check", sql`${table.purchasePrice} >= 0`),
    check("items_supply_price_check", sql`${table.supplyPrice} >= 0`),
    check("items_min_stock_qty_check", sql`${table.minStockQty} is null or ${table.minStockQty} >= 0`),
    index("items_item_name_idx").on(table.itemName),
    index("items_barcode_idx").on(table.barcode),
    index("items_category_idx").on(table.categoryMajor, table.categoryMinor),
  ],
);

export const suppliers = pgTable(
  "suppliers",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    supplierName: varchar("supplier_name", { length: 100 }).notNull(),
    contact: varchar("contact", { length: 50 }),
    managerName: varchar("manager_name", { length: 50 }),
    remarks: text("remarks"),
    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => [index("suppliers_supplier_name_idx").on(table.supplierName)],
);

export const adjustmentReasons = pgTable("adjustment_reasons", {
  code: varchar("code", { length: 20 }).primaryKey(),
  label: varchar("label", { length: 50 }).notNull(),
  requiresText: boolean("requires_text").notNull().default(false),
  sortOrder: integer("sort_order").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const inventoryLedger = pgTable(
  "inventory_ledger",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    itemId: bigint("item_id", { mode: "number" })
      .notNull()
      .references(() => items.id),
    ledgerType: varchar("ledger_type", { length: 20 }).notNull(),
    onHandDelta: integer("on_hand_delta").notNull().default(0),
    allocatedDelta: integer("allocated_delta").notNull().default(0),
    refType: varchar("ref_type", { length: 30 }).notNull(),
    refId: bigint("ref_id", { mode: "number" }).notNull(),
    memo: text("memo"),
    createdBy: bigint("created_by", { mode: "number" })
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("inventory_ledger_ref_type_ref_id_ledger_type_unique").on(
      table.refType,
      table.refId,
      table.ledgerType,
    ),
    check(
      "inventory_ledger_type_delta_check",
      sql`(${table.ledgerType} = 'INBOUND' and ${table.onHandDelta} > 0 and ${table.allocatedDelta} = 0)
        or (${table.ledgerType} = 'ALLOCATE' and ${table.onHandDelta} = 0 and ${table.allocatedDelta} > 0)
        or (${table.ledgerType} = 'OUTBOUND' and ${table.onHandDelta} < 0 and ${table.allocatedDelta} = ${table.onHandDelta})
        or (${table.ledgerType} = 'RELEASE' and ${table.onHandDelta} = 0 and ${table.allocatedDelta} < 0)
        or (${table.ledgerType} = 'ADJUST' and ${table.onHandDelta} <> 0 and ${table.allocatedDelta} = 0)
        or (${table.ledgerType} = 'OPENING' and ${table.onHandDelta} > 0 and ${table.allocatedDelta} = 0)`,
    ),
    index("inventory_ledger_item_id_id_idx").on(table.itemId, table.id),
  ],
);

export const stockAdjustments = pgTable(
  "stock_adjustments",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    itemId: bigint("item_id", { mode: "number" })
      .notNull()
      .references(() => items.id),
    deltaQty: integer("delta_qty").notNull(),
    reasonCode: varchar("reason_code", { length: 20 })
      .notNull()
      .references(() => adjustmentReasons.code),
    reasonText: text("reason_text"),
    adjustedBy: bigint("adjusted_by", { mode: "number" })
      .notNull()
      .references(() => users.id),
    adjustedAt: timestamp("adjusted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check("stock_adjustments_delta_qty_check", sql`${table.deltaQty} <> 0`)],
);

export const branchStocks = pgTable(
  "branch_stocks",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    branchId: bigint("branch_id", { mode: "number" })
      .notNull()
      .references(() => branches.id),
    itemId: bigint("item_id", { mode: "number" })
      .notNull()
      .references(() => items.id),
    stockQty: integer("stock_qty").notNull().default(0),
    updatedBy: bigint("updated_by", { mode: "number" }).references(() => users.id),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    unique("branch_stocks_branch_id_item_id_unique").on(table.branchId, table.itemId),
    check("branch_stocks_stock_qty_check", sql`${table.stockQty} >= 0`),
  ],
);

export const internalOrders = pgTable(
  "internal_orders",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    orderNo: varchar("order_no", { length: 20 }).notNull().unique(),
    branchId: bigint("branch_id", { mode: "number" })
      .notNull()
      .references(() => branches.id),
    itemId: bigint("item_id", { mode: "number" })
      .notNull()
      .references(() => items.id),
    requestedQty: integer("requested_qty").notNull(),
    requestedDueDate: date("requested_due_date").notNull(),
    remarks: text("remarks"),
    status: varchar("status", { length: 20 }).notNull(),
    approvedQty: integer("approved_qty").notNull().default(0),
    canceledQty: integer("canceled_qty").notNull().default(0),
    outstandingQty: integer("outstanding_qty").generatedAlwaysAs(
      sql`requested_qty - approved_qty - canceled_qty`,
    ),
    rejectReason: text("reject_reason"),
    originOrderId: bigint("origin_order_id", { mode: "number" }).references(
      (): AnyPgColumn => internalOrders.id,
    ),
    createdBy: bigint("created_by", { mode: "number" })
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("internal_orders_requested_qty_check", sql`${table.requestedQty} > 0`),
    check("internal_orders_approved_qty_check", sql`${table.approvedQty} >= 0`),
    check("internal_orders_canceled_qty_check", sql`${table.canceledQty} >= 0`),
    check(
      "internal_orders_qty_total_check",
      sql`${table.approvedQty} + ${table.canceledQty} <= ${table.requestedQty}`,
    ),
    check(
      "internal_orders_reject_reason_check",
      sql`${table.status} <> 'REJECTED' or ${table.rejectReason} is not null`,
    ),
    index("internal_orders_branch_created_at_idx").on(table.branchId, table.createdAt),
    index("internal_orders_item_id_idx").on(table.itemId),
    index("internal_orders_status_idx").on(table.status),
    index("internal_orders_order_no_idx").on(table.orderNo),
  ],
);

export const internalOrderApprovals = pgTable(
  "internal_order_approvals",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    internalOrderId: bigint("internal_order_id", { mode: "number" })
      .notNull()
      .references(() => internalOrders.id),
    approvedQty: integer("approved_qty").notNull(),
    plannedShipDate: date("planned_ship_date").notNull(),
    status: varchar("status", { length: 20 }).notNull(),
    approvedBy: bigint("approved_by", { mode: "number" })
      .notNull()
      .references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }).notNull().defaultNow(),
    canceledBy: bigint("canceled_by", { mode: "number" }).references(() => users.id),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
  },
  (table) => [
    check("internal_order_approvals_approved_qty_check", sql`${table.approvedQty} > 0`),
    index("internal_order_approvals_internal_order_id_idx").on(table.internalOrderId),
    index("internal_order_approvals_status_idx").on(table.status),
  ],
);

export const shipments = pgTable(
  "shipments",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    approvalId: bigint("approval_id", { mode: "number" })
      .notNull()
      .unique()
      .references(() => internalOrderApprovals.id),
    shippedQty: integer("shipped_qty").notNull(),
    shippedBy: bigint("shipped_by", { mode: "number" })
      .notNull()
      .references(() => users.id),
    shippedAt: timestamp("shipped_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check("shipments_shipped_qty_check", sql`${table.shippedQty} > 0`)],
);

export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    poNumber: varchar("po_number", { length: 20 }).notNull().unique(),
    supplierId: bigint("supplier_id", { mode: "number" })
      .notNull()
      .references(() => suppliers.id),
    orderedDate: date("ordered_date").notNull(),
    requestedDueDate: date("requested_due_date").notNull(),
    remarks: text("remarks"),
    status: varchar("status", { length: 20 }).notNull(),
    createdBy: bigint("created_by", { mode: "number" })
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("purchase_orders_supplier_id_idx").on(table.supplierId),
    index("purchase_orders_ordered_date_idx").on(table.orderedDate),
    index("purchase_orders_status_idx").on(table.status),
    index("purchase_orders_po_number_idx").on(table.poNumber),
  ],
);

export const purchaseOrderLines = pgTable(
  "purchase_order_lines",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    purchaseOrderId: bigint("purchase_order_id", { mode: "number" })
      .notNull()
      .references(() => purchaseOrders.id),
    itemId: bigint("item_id", { mode: "number" })
      .notNull()
      .references(() => items.id),
    requestedQty: integer("requested_qty").notNull(),
    purchasePrice: integer("purchase_price").notNull(),
    remarks: text("remarks"),
  },
  (table) => [
    unique("purchase_order_lines_purchase_order_id_item_id_unique").on(
      table.purchaseOrderId,
      table.itemId,
    ),
    check("purchase_order_lines_requested_qty_check", sql`${table.requestedQty} > 0`),
    check("purchase_order_lines_purchase_price_check", sql`${table.purchasePrice} >= 0`),
  ],
);

export const receipts = pgTable(
  "receipts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    purchaseOrderLineId: bigint("purchase_order_line_id", { mode: "number" })
      .notNull()
      .unique()
      .references(() => purchaseOrderLines.id),
    receivedQty: integer("received_qty").notNull(),
    receivedBy: bigint("received_by", { mode: "number" })
      .notNull()
      .references(() => users.id),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check("receipts_received_qty_check", sql`${table.receivedQty} > 0`)],
);

export const vItemStock = pgView("v_item_stock").as((queryBuilder) =>
  queryBuilder
    .select({
      itemId: items.id,
      onHandQty: sql<number>`coalesce(sum(${inventoryLedger.onHandDelta}), 0)`.as("on_hand_qty"),
      allocatedQty: sql<number>`coalesce(sum(${inventoryLedger.allocatedDelta}), 0)`.as(
        "allocated_qty",
      ),
      availableQty: sql<number>`coalesce(sum(${inventoryLedger.onHandDelta}), 0) - coalesce(sum(${inventoryLedger.allocatedDelta}), 0)`.as(
        "available_qty",
      ),
    })
    .from(items)
    .leftJoin(inventoryLedger, sql`${inventoryLedger.itemId} = ${items.id}`)
    .groupBy(items.id),
);
