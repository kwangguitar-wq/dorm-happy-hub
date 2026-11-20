import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import {
  BarChart3, UserCog, BedDouble, CalendarDays, Wallet, Wrench, Home,
  LayoutDashboard, LogOut, Menu, Receipt, Users, X, Building2, ChevronRight, Download, CheckCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DORM_NAME, meQuery, roleLabel } from "@/lib/dorm";
import { Button } from "@/components/ui/button";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }> };

const staffNav = [
  { to: "/dashboard", label: "แดชบอร์ด", icon: LayoutDashboard },
  { to: "/rooms", label: "ห้องพัก", icon: BedDouble },
  { to: "/tenants/daily", label: "ผู้เช่ารายวัน", icon: CalendarDays },
  { to: "/tenants/monthly", label: "ผู้เช่ารายเดือน", icon: Users },
  { to: "/bills", label: "มิเตอร์และบิล", icon: Receipt },
  { to: "/payments", label: "ตรวจสอบการชำระ", icon: Wallet },
  { to: "/repairs", label: "แจ้งซ่อม", icon: Wrench },
  { to: "/reports", label: "รายงาน", icon: BarChart3 },
  { to: "/users", label: "จัดการผู้ใช้", icon: UserCog },
] as const;
const tenantNav = [{ to: "/my", label: "ห้องของฉัน", icon: Home }] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { data: me } = useQuery(meQuery);
  const [open, setOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const check = () => setIsInstalled(window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    const onPrompt = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPromptEvent); };
    const onInstalled = () => { setIsInstalled(true); setInstallPrompt(null); };
    check();
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  async function installApp() {
    if (isInstalled) return;
    if (installPrompt) {
      try {
        await installPrompt.prompt();
        const choice = await installPrompt.userChoice;
        if (choice.outcome === "accepted") setIsInstalled(true);
        setInstallPrompt(null);
      } catch (error) { console.error("[PWA] Install prompt failed:", error); window.alert("ไม่สามารถเปิดหน้าติดตั้งได้ กรุณาใช้เมนูของเบราว์เซอร์"); }
      return;
    }
    const ua = navigator.userAgent;
    if (/iphone|ipad|ipod/i.test(ua)) window.alert("ติดตั้งบน iPhone/iPad: เปิดเว็บไซต์ด้วย Safari แตะปุ่มแชร์ แล้วเลือก เพิ่มไปยังหน้าจอโฮม (Add to Home Screen)");
    else if (/android/i.test(ua)) window.alert("ติดตั้งบน Android: เปิดเว็บไซต์ด้วย Chrome แตะเมนู ⋮ แล้วเลือก ติดตั้งแอป หรือ เพิ่มลงในหน้าจอหลัก");
    else window.alert("ติดตั้งบนคอมพิวเตอร์: เปิดด้วย Google Chrome หรือ Microsoft Edge แล้วคลิกไอคอนติดตั้งข้างแถบที่อยู่ หรือเลือกเมนูเบราว์เซอร์ > ติดตั้ง Dorm Happy Hub");
  }
  const qc = useQueryClient();
  const navigate = useNavigate();
  const nav = me?.role === "tenant" ? tenantNav : staffNav;
  const initial = (me?.name || me?.email || "U").trim().charAt(0).toUpperCase();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-[#102b50] text-white">
      <div className="border-b border-white/10 px-5 py-6">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-cyan-200 shadow-inner">
          <Building2 className="h-7 w-7" />
        </div>
        <p className="text-center text-base font-semibold tracking-wide">DORM HAPPY HUB</p>
        <p className="mt-1 text-center text-xs text-blue-100/70">{DORM_NAME}</p>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
        <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-100/45">เมนูหลัก</p>
        {nav.map((n, index) => (
          <div key={n.to}>
            {(index === 1 || index === 2 || index === 4 || index === 7) && (
              <div className="mx-2 my-3 border-t border-white/10" />
            )}
            <Link
              to={n.to}
              onClick={() => setOpen(false)}
              className="group flex items-center gap-3 rounded-xl border-l-[3px] border-transparent px-3 py-3 text-sm font-medium text-blue-50/80 transition hover:bg-white/10 hover:text-white"
              activeProps={{ className: "border-l-white !bg-[#071a35] !text-white shadow-sm" }}
            >
              <n.icon className="h-[18px] w-[18px] shrink-0 opacity-90" />
              <span className="flex-1">{n.label}</span>
              <ChevronRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-60" />
            </Link>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 p-4">
        <div className="mb-3 flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-indigo-500 text-sm font-bold text-white">{initial}</div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{me?.name || "ผู้ใช้งาน"}</p>
            <p className="text-xs text-blue-100/60">{me ? roleLabel[me.role] : "กำลังโหลด..."}</p>
          </div>
        </div>
        <button onClick={signOut} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-blue-100/75 transition hover:bg-white/10 hover:text-white">
          <LogOut className="h-4 w-4" /> ออกจากระบบ
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f2f5fa] md:flex">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 xl:w-64 md:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button aria-label="ปิดเมนู" className="absolute inset-0 bg-slate-950/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 shadow-2xl">{sidebar}</div>
        </div>
      )}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-[66px] items-center justify-between bg-gradient-to-r from-[#071a3b] to-[#1d3b64] px-4 text-white shadow-md md:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 hover:text-white md:hidden" onClick={() => setOpen(!open)} aria-label="เมนู">
              {open ? <X /> : <Menu />}
            </Button>
            <div>
              <p className="font-display text-base font-semibold">{DORM_NAME}</p>
              <p className="hidden text-[11px] text-blue-100/65 sm:block">ระบบบริหารจัดการหอพัก</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium">ไทย</span>
            <span className="hidden rounded-lg border border-white/25 px-3 py-1.5 text-xs text-blue-100/75 sm:inline-flex">TH</span>
            <div className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 text-xs font-bold shadow">{initial}</div>
            <Button variant="ghost" size="sm" onClick={installApp} disabled={isInstalled} className="h-9 gap-1.5 px-2 text-white hover:bg-white/10 hover:text-white sm:px-3" title={isInstalled ? "ติดตั้งแอปแล้ว" : "ติดตั้ง Dorm Happy Hub"}>
              {isInstalled ? <CheckCircle2 className="h-4 w-4" /> : <Download className="h-4 w-4" />}
              <span className="hidden text-xs sm:inline">{isInstalled ? "ติดตั้งแล้ว" : "ติดตั้งแอป"}</span>
            </Button>
            <span className="hidden max-w-36 truncate text-xs text-blue-50/85 lg:block">{me?.name || me?.email || "บัญชีผู้ใช้"}</span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1600px] flex-1 p-4 md:p-6 xl:p-7">{children}</main>
        <footer className="bg-[#1b385f] px-4 py-4 text-center text-[11px] text-blue-50/80">
          © {new Date().getFullYear()} {DORM_NAME} · Dorm Happy Hub
        </footer>
      </div>
    </div>
  );
}

export function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-100 bg-gradient-to-r from-white to-[#f0f2ff] px-5 py-4 shadow-sm">
      <div className="min-w-0">
        <h2 className="font-display text-xl font-semibold text-[#173456] md:text-2xl">{title}</h2>
        {sub && <p className="mt-1 text-xs text-slate-500 md:text-sm">{sub}</p>}
      </div>
      {action}
    </div>
  );
}
