import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authenticateCredentials } from "@/src/lib/auth-credentials";
import { roles, type Role } from "@/src/lib/permissions";
import { loginRequestSchema } from "@/src/lib/schemas/auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        loginId: { label: "로그인 ID", type: "text" },
        password: { label: "비밀번호", type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = loginRequestSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const user = await authenticateCredentials(parsed.data.loginId, parsed.data.password);
        if (!user) {
          return null;
        }

        return {
          id: String(user.userId),
          name: user.userName,
          ...user,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.userId = user.userId;
        token.role = user.role;
        token.branchId = user.branchId;
        token.branchName = user.branchName;
      }

      return token;
    },
    session({ session, token }) {
      const role = roles.includes(token.role as Role) ? (token.role as Role) : "BRANCH";

      session.user = {
        ...session.user,
        userId: Number(token.userId),
        role,
        branchId: typeof token.branchId === "number" ? token.branchId : null,
        branchName: typeof token.branchName === "string" ? token.branchName : null,
      };

      return session;
    },
  },
});
