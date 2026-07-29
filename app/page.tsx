import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/src/lib/auth";
import { LogoutButton } from "@/src/components/auth/logout-button";

const roleLabels = {
  ADMIN: "관리자",
  PURCHASER: "구매",
  WAREHOUSE: "창고",
  BRANCH: "지점",
} as const;

export default async function Home() {
  const session = await auth();
  if (!session?.user?.userId) {
    redirect("/login");
  }

  const role = session.user.role;
  const userName = session.user.name ?? "사용자";

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">한결물산 ERP</p>
            <h1 className="mt-1 text-2xl font-semibold">대시보드</h1>
          </div>
          <div className="flex items-center gap-4 text-right text-sm">
            <div>
              <p className="font-medium">{userName}</p>
              <p className="text-muted-foreground">{roleLabels[role]}</p>
            </div>
            <LogoutButton />
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          <Link className="rounded-xl border bg-card p-6 transition-colors hover:bg-accent" href="/items">
            <h2 className="text-lg font-semibold">품목 관리</h2>
            <p className="mt-2 text-sm text-muted-foreground">품목 정보와 본사 재고 현황을 조회합니다.</p>
          </Link>
          <Link className="rounded-xl border bg-card p-6 transition-colors hover:bg-accent" href="/internal-orders">
            <h2 className="text-lg font-semibold">사내 발주</h2>
            <p className="mt-2 text-sm text-muted-foreground">지점 요청, 승인, 출고 진행 상태를 확인합니다.</p>
          </Link>
        </section>
      </div>
    </main>
  );
}
