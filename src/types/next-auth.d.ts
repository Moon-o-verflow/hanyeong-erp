import type { DefaultSession } from "next-auth";

import type { Role } from "@/src/lib/permissions";

declare module "next-auth" {
  interface User {
    userId: number;
    role: Role;
    branchId: number | null;
    branchName: string | null;
  }

  interface Session {
    user: {
      userId: number;
      role: Role;
      branchId: number | null;
      branchName: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: number;
    role: Role;
    branchId: number | null;
    branchName: string | null;
  }
}
