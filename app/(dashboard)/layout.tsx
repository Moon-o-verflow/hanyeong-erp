import Link from "next/link";

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6">
          <Link className="font-semibold" href="/items">
            한결물산 ERP
          </Link>
          <nav className="ml-8 flex h-full items-center">
            <Link className="inline-flex h-full items-center border-b-2 border-primary px-3 text-sm font-medium" href="/items">
              품목 관리
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
