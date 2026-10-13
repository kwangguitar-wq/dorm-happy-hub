import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { BarChart3, BedDouble, CalendarDays, Wallet, Wrench, Home, LayoutDashboard, LogOut, Menu, Receipt, Users, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DORM_NAME, meQuery, roleLabel } from "@/lib/dorm";
import { Button } from "@/components/ui/button";

const staffNav = [
  { to: "/dashboard", label: "แดชบอร์ด", icon: LayoutDashboard },
  { to: "/rooms", label: "ห้องพัก", icon: BedDouble },
  { to: "/tenants/daily", label: "ผู้เช่ารายวัน", icon: CalendarDays },
  { to: "/tenants/monthly", label: "ผู้เช่ารายเดือน", icon: Users },
  { to: "/bills", label: "มิเตอร์และบิล", icon: Receipt },
  { to: "/payments", label: "ตรวจสอบการชำระ", icon: Wallet },
  { to: "/repairs", label: "แจ้งซ่อม", icon: Wrench },
  { to: "/reports", label: "รายงาน", icon: BarChart3 },
] as const;
const tenantNav = [{ to: "/my", label: "ห้องของฉัน", icon: Home }] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { data: me } = useQuery(meQuery);
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const nav = me?.role === "tenant" ? tenantNav : staffNav;

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="px-5 py-6">
        <p className="text-xs uppercase tracking-widest text-sidebar-foreground/60">หอพัก</p>
        <h1 className="text-xl font-semibold">{DORM_NAME}</h1>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {nav.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/80 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            activeProps={{ className: "bg-sidebar-primary !text-sidebar-primary-foreground" }}
          >
            <n.icon className="h-4 w-4" />
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-sidebar-border p-4">
        <p className="truncate text-sm font-medium">{me?.name}</p>
        <p className="text-xs text-sidebar-foreground/60">{me ? roleLabel[me.role] : ""}</p>
        <button
          onClick={signOut}
          className="mt-3 flex items-center gap-2 text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground"
        >
          <LogOut className="h-4 w-4" /> ออกจากระบบ
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen md:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 md:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72">{sidebar}</div>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/90 px-4 py-3 backdrop-blur md:hidden">
          <span className="font-display font-semibold">{DORM_NAME}</span>
          <Button variant="ghost" size="icon" onClick={() => setOpen(!open)} aria-label="เมนู">
            {open ? <X /> : <Menu />}
          </Button>
        </header>
        <main className="mx-auto max-w-6xl p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-2xl font-semibold md:text-3xl">{title}</h2>
        {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
      </div>
      {action}
    </div>
  );
}
