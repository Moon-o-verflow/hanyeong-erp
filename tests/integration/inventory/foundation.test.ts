import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

config({ path: ".env.local", quiet: true });

const { db, pool } = await import("@/src/db/client");
const { withItemLock } = await import("@/src/db/lock");

afterAll(async () => {
  await pool.end();
});

describe("database foundation", () => {
  it("uses the pooled connection and acquires an item advisory lock", async () => {
    await expect(db.execute(sql.raw("select 1"))).resolves.toBeDefined();

    await expect(
      withItemLock(1, async (transaction) => transaction.execute(sql.raw("select 1"))),
    ).resolves.toBeDefined();
  });

  it("creates the inventory view and ledger duplicate constraint", async () => {
    const constraintResult = await db.execute(
      sql.raw(
        "select count(*)::int as count from pg_constraint where conname = 'inventory_ledger_ref_type_ref_id_ledger_type_unique'",
      ),
    );
    const viewResult = await db.execute(
      sql.raw("select to_regclass('public.v_item_stock') is not null as exists"),
    );

    expect((constraintResult.rows[0] as { count: number }).count).toBe(1);
    expect((viewResult.rows[0] as { exists: boolean }).exists).toBe(true);
  });

  it("rejects direct updates to the generated outstanding quantity", async () => {
    await expect(
      db.execute(sql.raw("update internal_orders set outstanding_qty = 1")),
    ).rejects.toThrow();
  });

  it("seeds the required branches, adjustment reasons, and initial users", async () => {
    const [branchResult, reasonResult, userResult] = await Promise.all([
      db.execute(sql.raw("select count(*)::int as count from branches")),
      db.execute(sql.raw("select count(*)::int as count from adjustment_reasons")),
      db.execute(sql.raw("select count(*)::int as count from users")),
    ]);

    expect((branchResult.rows[0] as { count: number }).count).toBe(5);
    expect((reasonResult.rows[0] as { count: number }).count).toBe(4);
    expect((userResult.rows[0] as { count: number }).count).toBe(17);
  });
});
