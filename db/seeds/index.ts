import { Pool, neonConfig } from "@neondatabase/serverless";
import { hash } from "bcryptjs";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/neon-serverless";
import WebSocket from "ws";

import {
  adjustmentReasons,
  branches,
  users,
} from "@/src/db/schema";

config({ path: ".env.local", quiet: true });

const connectionString = process.env.DATABASE_URL_UNPOOLED;
const initialPassword = process.env.INITIAL_ACCOUNT_PASSWORD;

if (!connectionString) {
  throw new Error("DATABASE_URL_UNPOOLED 환경 변수가 필요합니다.");
}

if (!initialPassword) {
  throw new Error("INITIAL_ACCOUNT_PASSWORD 환경 변수가 필요합니다.");
}

neonConfig.webSocketConstructor = WebSocket;

const pool = new Pool({ connectionString });
const seedDb = drizzle(pool);

const branchDefinitions = ["강남지점", "수원지점", "성남지점", "인천지점", "대전지점"] as const;

const branchUsers = [
  { loginId: "gn1", userName: "김지점", branchName: "강남지점" },
  { loginId: "gn2", userName: "이지점", branchName: "강남지점" },
  { loginId: "sw1", userName: "박지점", branchName: "수원지점" },
  { loginId: "sw2", userName: "최지점", branchName: "수원지점" },
  { loginId: "sn1", userName: "정지점", branchName: "성남지점" },
  { loginId: "sn2", userName: "한지점", branchName: "성남지점" },
  { loginId: "ic1", userName: "오지점", branchName: "인천지점" },
  { loginId: "ic2", userName: "윤지점", branchName: "인천지점" },
  { loginId: "dj1", userName: "장지점", branchName: "대전지점" },
  { loginId: "dj2", userName: "임지점", branchName: "대전지점" },
] as const;

async function seed() {
  if (!initialPassword) {
    throw new Error("INITIAL_ACCOUNT_PASSWORD 환경 변수가 필요합니다.");
  }

  const passwordHash = await hash(initialPassword, 12);

  await seedDb.transaction(async (transaction) => {
    // BR-BRS-003: five fixed initial branches.
    await transaction
      .insert(branches)
      .values(branchDefinitions.map((branchName) => ({ branchName })))
      .onConflictDoNothing({ target: branches.branchName });

    const seededBranches = await transaction
      .select({ id: branches.id, branchName: branches.branchName })
      .from(branches);
    const branchIdByName = new Map(
      seededBranches.map((branch) => [branch.branchName, branch.id]),
    );

    // BR-AUT-001: every initial user has exactly one role.
    await transaction
      .insert(users)
      .values([
        { loginId: "admin1", userName: "이관리", passwordHash, role: "ADMIN" },
        { loginId: "admin2", userName: "김관리", passwordHash, role: "ADMIN" },
        { loginId: "admin3", userName: "박관리", passwordHash, role: "ADMIN" },
        { loginId: "wh1", userName: "박창고", passwordHash, role: "WAREHOUSE" },
        { loginId: "wh2", userName: "최창고", passwordHash, role: "WAREHOUSE" },
        { loginId: "wh3", userName: "정창고", passwordHash, role: "WAREHOUSE" },
        { loginId: "wh4", userName: "한창고", passwordHash, role: "WAREHOUSE" },
        ...branchUsers.map((user) => ({
          loginId: user.loginId,
          userName: user.userName,
          passwordHash,
          role: "BRANCH",
          branchId: branchIdByName.get(user.branchName),
        })),
      ])
      .onConflictDoNothing({ target: users.loginId });

    // BR-INV-017: adjustment reasons are maintained as database code data.
    await transaction
      .insert(adjustmentReasons)
      .values([
        { code: "DAMAGE", label: "파손", sortOrder: 1 },
        { code: "LOSS", label: "분실", sortOrder: 2 },
        { code: "STOCKTAKE", label: "실사 차이", sortOrder: 3 },
        { code: "OTHER", label: "기타", requiresText: true, sortOrder: 4 },
      ])
      .onConflictDoNothing({ target: adjustmentReasons.code });
  });
}

seed()
  .then(() => {
    process.stdout.write("Seed completed.\n");
  })
  .finally(async () => {
    await pool.end();
  });
