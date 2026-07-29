import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import WebSocket from "ws";

import * as schema from "@/src/db/schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL 환경 변수가 필요합니다.");
}

neonConfig.webSocketConstructor = WebSocket;

const pool = new Pool({ connectionString });

// Drizzle only uses named prepared statements through an explicit .prepare() call.
// This client intentionally exposes no prepared query helpers for PgBouncer transaction mode.
export const db = drizzle(pool, { schema });

export { pool };
