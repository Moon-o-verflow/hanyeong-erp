CREATE TABLE "adjustment_reasons" (
	"code" varchar(20) PRIMARY KEY NOT NULL,
	"label" varchar(50) NOT NULL,
	"requires_text" boolean DEFAULT false NOT NULL,
	"sort_order" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branch_stocks" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"branch_id" bigint NOT NULL,
	"item_id" bigint NOT NULL,
	"stock_qty" integer DEFAULT 0 NOT NULL,
	"updated_by" bigint,
	"updated_at" timestamp with time zone,
	CONSTRAINT "branch_stocks_branch_id_item_id_unique" UNIQUE("branch_id","item_id"),
	CONSTRAINT "branch_stocks_stock_qty_check" CHECK ("branch_stocks"."stock_qty" >= 0)
);
--> statement-breakpoint
CREATE TABLE "branches" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"branch_name" varchar(50) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "branches_branch_name_unique" UNIQUE("branch_name")
);
--> statement-breakpoint
CREATE TABLE "internal_order_approvals" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"internal_order_id" bigint NOT NULL,
	"approved_qty" integer NOT NULL,
	"planned_ship_date" date NOT NULL,
	"status" varchar(20) NOT NULL,
	"approved_by" bigint NOT NULL,
	"approved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"canceled_by" bigint,
	"canceled_at" timestamp with time zone,
	CONSTRAINT "internal_order_approvals_approved_qty_check" CHECK ("internal_order_approvals"."approved_qty" > 0)
);
--> statement-breakpoint
CREATE TABLE "internal_orders" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"order_no" varchar(20) NOT NULL,
	"branch_id" bigint NOT NULL,
	"item_id" bigint NOT NULL,
	"requested_qty" integer NOT NULL,
	"requested_due_date" date NOT NULL,
	"remarks" text,
	"status" varchar(20) NOT NULL,
	"approved_qty" integer DEFAULT 0 NOT NULL,
	"canceled_qty" integer DEFAULT 0 NOT NULL,
	"outstanding_qty" integer GENERATED ALWAYS AS (requested_qty - approved_qty - canceled_qty) STORED,
	"reject_reason" text,
	"origin_order_id" bigint,
	"created_by" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "internal_orders_order_no_unique" UNIQUE("order_no"),
	CONSTRAINT "internal_orders_requested_qty_check" CHECK ("internal_orders"."requested_qty" > 0),
	CONSTRAINT "internal_orders_approved_qty_check" CHECK ("internal_orders"."approved_qty" >= 0),
	CONSTRAINT "internal_orders_canceled_qty_check" CHECK ("internal_orders"."canceled_qty" >= 0),
	CONSTRAINT "internal_orders_qty_total_check" CHECK ("internal_orders"."approved_qty" + "internal_orders"."canceled_qty" <= "internal_orders"."requested_qty"),
	CONSTRAINT "internal_orders_reject_reason_check" CHECK ("internal_orders"."status" <> 'REJECTED' or "internal_orders"."reject_reason" is not null)
);
--> statement-breakpoint
CREATE TABLE "inventory_ledger" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"item_id" bigint NOT NULL,
	"ledger_type" varchar(20) NOT NULL,
	"on_hand_delta" integer DEFAULT 0 NOT NULL,
	"allocated_delta" integer DEFAULT 0 NOT NULL,
	"ref_type" varchar(30) NOT NULL,
	"ref_id" bigint NOT NULL,
	"memo" text,
	"created_by" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_ledger_ref_type_ref_id_ledger_type_unique" UNIQUE("ref_type","ref_id","ledger_type"),
	CONSTRAINT "inventory_ledger_type_delta_check" CHECK (("inventory_ledger"."ledger_type" = 'INBOUND' and "inventory_ledger"."on_hand_delta" > 0 and "inventory_ledger"."allocated_delta" = 0)
        or ("inventory_ledger"."ledger_type" = 'ALLOCATE' and "inventory_ledger"."on_hand_delta" = 0 and "inventory_ledger"."allocated_delta" > 0)
        or ("inventory_ledger"."ledger_type" = 'OUTBOUND' and "inventory_ledger"."on_hand_delta" < 0 and "inventory_ledger"."allocated_delta" = "inventory_ledger"."on_hand_delta")
        or ("inventory_ledger"."ledger_type" = 'RELEASE' and "inventory_ledger"."on_hand_delta" = 0 and "inventory_ledger"."allocated_delta" < 0)
        or ("inventory_ledger"."ledger_type" = 'ADJUST' and "inventory_ledger"."on_hand_delta" <> 0 and "inventory_ledger"."allocated_delta" = 0)
        or ("inventory_ledger"."ledger_type" = 'OPENING' and "inventory_ledger"."on_hand_delta" > 0 and "inventory_ledger"."allocated_delta" = 0))
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"item_code" varchar(50) NOT NULL,
	"barcode" varchar(50),
	"item_name" varchar(200) NOT NULL,
	"category_major" varchar(50),
	"category_minor" varchar(50),
	"unit_spec" varchar(50),
	"unit_name" varchar(20),
	"pack_qty" integer DEFAULT 1 NOT NULL,
	"pack_unit" varchar(20) NOT NULL,
	"purchase_price" integer NOT NULL,
	"supply_price" integer NOT NULL,
	"min_stock_qty" integer,
	"remarks" text,
	"spec_raw" varchar(200),
	"is_spec_parse_failed" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "items_item_code_unique" UNIQUE("item_code"),
	CONSTRAINT "items_pack_qty_check" CHECK ("items"."pack_qty" > 0),
	CONSTRAINT "items_purchase_price_check" CHECK ("items"."purchase_price" >= 0),
	CONSTRAINT "items_supply_price_check" CHECK ("items"."supply_price" >= 0),
	CONSTRAINT "items_min_stock_qty_check" CHECK ("items"."min_stock_qty" is null or "items"."min_stock_qty" >= 0)
);
--> statement-breakpoint
CREATE TABLE "purchase_order_lines" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"purchase_order_id" bigint NOT NULL,
	"item_id" bigint NOT NULL,
	"requested_qty" integer NOT NULL,
	"purchase_price" integer NOT NULL,
	"remarks" text,
	CONSTRAINT "purchase_order_lines_purchase_order_id_item_id_unique" UNIQUE("purchase_order_id","item_id"),
	CONSTRAINT "purchase_order_lines_requested_qty_check" CHECK ("purchase_order_lines"."requested_qty" > 0),
	CONSTRAINT "purchase_order_lines_purchase_price_check" CHECK ("purchase_order_lines"."purchase_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"po_number" varchar(20) NOT NULL,
	"supplier_id" bigint NOT NULL,
	"ordered_date" date NOT NULL,
	"requested_due_date" date NOT NULL,
	"remarks" text,
	"status" varchar(20) NOT NULL,
	"created_by" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_orders_po_number_unique" UNIQUE("po_number")
);
--> statement-breakpoint
CREATE TABLE "receipts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"purchase_order_line_id" bigint NOT NULL,
	"received_qty" integer NOT NULL,
	"received_by" bigint NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "receipts_purchase_order_line_id_unique" UNIQUE("purchase_order_line_id"),
	CONSTRAINT "receipts_received_qty_check" CHECK ("receipts"."received_qty" > 0)
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"approval_id" bigint NOT NULL,
	"shipped_qty" integer NOT NULL,
	"shipped_by" bigint NOT NULL,
	"shipped_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipments_approval_id_unique" UNIQUE("approval_id"),
	CONSTRAINT "shipments_shipped_qty_check" CHECK ("shipments"."shipped_qty" > 0)
);
--> statement-breakpoint
CREATE TABLE "stock_adjustments" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"item_id" bigint NOT NULL,
	"delta_qty" integer NOT NULL,
	"reason_code" varchar(20) NOT NULL,
	"reason_text" text,
	"adjusted_by" bigint NOT NULL,
	"adjusted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_adjustments_delta_qty_check" CHECK ("stock_adjustments"."delta_qty" <> 0)
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"supplier_name" varchar(100) NOT NULL,
	"contact" varchar(50),
	"manager_name" varchar(50),
	"remarks" text,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"login_id" varchar(50) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"user_name" varchar(50) NOT NULL,
	"role" varchar(20) NOT NULL,
	"branch_id" bigint,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_login_id_unique" UNIQUE("login_id"),
	CONSTRAINT "users_role_check" CHECK ("users"."role" in ('ADMIN', 'PURCHASER', 'WAREHOUSE', 'BRANCH')),
	CONSTRAINT "users_branch_check" CHECK (("users"."role" = 'BRANCH' and "users"."branch_id" is not null) or ("users"."role" <> 'BRANCH' and "users"."branch_id" is null))
);
--> statement-breakpoint
ALTER TABLE "branch_stocks" ADD CONSTRAINT "branch_stocks_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_stocks" ADD CONSTRAINT "branch_stocks_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_stocks" ADD CONSTRAINT "branch_stocks_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_order_approvals" ADD CONSTRAINT "internal_order_approvals_internal_order_id_internal_orders_id_fk" FOREIGN KEY ("internal_order_id") REFERENCES "public"."internal_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_order_approvals" ADD CONSTRAINT "internal_order_approvals_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_order_approvals" ADD CONSTRAINT "internal_order_approvals_canceled_by_users_id_fk" FOREIGN KEY ("canceled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_orders" ADD CONSTRAINT "internal_orders_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_orders" ADD CONSTRAINT "internal_orders_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_orders" ADD CONSTRAINT "internal_orders_origin_order_id_internal_orders_id_fk" FOREIGN KEY ("origin_order_id") REFERENCES "public"."internal_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_orders" ADD CONSTRAINT "internal_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_ledger" ADD CONSTRAINT "inventory_ledger_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_ledger" ADD CONSTRAINT "inventory_ledger_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_purchase_order_line_id_purchase_order_lines_id_fk" FOREIGN KEY ("purchase_order_line_id") REFERENCES "public"."purchase_order_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_received_by_users_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_approval_id_internal_order_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."internal_order_approvals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_shipped_by_users_id_fk" FOREIGN KEY ("shipped_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_reason_code_adjustment_reasons_code_fk" FOREIGN KEY ("reason_code") REFERENCES "public"."adjustment_reasons"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_adjusted_by_users_id_fk" FOREIGN KEY ("adjusted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "internal_order_approvals_internal_order_id_idx" ON "internal_order_approvals" USING btree ("internal_order_id");--> statement-breakpoint
CREATE INDEX "internal_order_approvals_status_idx" ON "internal_order_approvals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "internal_orders_branch_created_at_idx" ON "internal_orders" USING btree ("branch_id","created_at");--> statement-breakpoint
CREATE INDEX "internal_orders_item_id_idx" ON "internal_orders" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "internal_orders_status_idx" ON "internal_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "internal_orders_order_no_idx" ON "internal_orders" USING btree ("order_no");--> statement-breakpoint
CREATE INDEX "inventory_ledger_item_id_id_idx" ON "inventory_ledger" USING btree ("item_id","id");--> statement-breakpoint
CREATE INDEX "items_item_name_idx" ON "items" USING btree ("item_name");--> statement-breakpoint
CREATE INDEX "items_barcode_idx" ON "items" USING btree ("barcode");--> statement-breakpoint
CREATE INDEX "items_category_idx" ON "items" USING btree ("category_major","category_minor");--> statement-breakpoint
CREATE INDEX "purchase_orders_supplier_id_idx" ON "purchase_orders" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "purchase_orders_ordered_date_idx" ON "purchase_orders" USING btree ("ordered_date");--> statement-breakpoint
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "purchase_orders_po_number_idx" ON "purchase_orders" USING btree ("po_number");--> statement-breakpoint
CREATE INDEX "suppliers_supplier_name_idx" ON "suppliers" USING btree ("supplier_name");--> statement-breakpoint
CREATE VIEW "public"."v_item_stock" AS (select "items"."id", coalesce(sum("inventory_ledger"."on_hand_delta"), 0) as "on_hand_qty", coalesce(sum("inventory_ledger"."allocated_delta"), 0) as "allocated_qty", coalesce(sum("inventory_ledger"."on_hand_delta"), 0) - coalesce(sum("inventory_ledger"."allocated_delta"), 0) as "available_qty" from "items" left join "inventory_ledger" on "inventory_ledger"."item_id" = "items"."id" group by "items"."id");