import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BedDouble, CalendarDays, Users, Wrench, Wallet, ReceiptText,
  DoorOpen, ArrowUpRight,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend,
} from "recharts";
import { PageHeader } from "@/components/AppShell";
import {
  baht, rentalsQuery, roomsQuery, roomStatusLabel, thDate,
} from "@/lib/dorm";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [
    { title: "แดชบอร์ด — หอพักแม่ปะ 409" },
    { name: "description", content: "ภาพรวมห้องพัก ผู้เช่า รายรับ และงานซ่อมของหอพักแม่ปะ 409" },
    { property: "og:title", content: "แดชบอร์ด — หอพักแม่ปะ 409" },
    { property: "og:description", content: "ภาพรวมการบริหารจัดการหอพักแม่ปะ 409" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Dashboard,
});

const money = (value: number) => new Intl.NumberFormat("th-TH", {
  maximumFractionDigits: 0,
}).format(value);

function dateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const statusClass: Record<string, string> = {
  vacant: "bg-emerald-50 text-emerald-700 border-emerald-200",
  occupied: "bg-blue-50 text-blue-700 border-blue-200",
  maintenance: "bg-amber-50 text-amber-700 border-amber-200",
};
const repairStatus: Record<string, string> = {
  pending: "รอดำเนินการ",
  in_progress: "กำลังซ่อม",
  completed: "เสร็จแล้ว",
  cancelled: "ยกเลิก",
};

function Dashboard() {
  const { data: rooms = [], isLoading: roomsLoading } = useQuery(roomsQuery);
  const { data: rentals = [] } = useQuery(rentalsQuery());
  const { data: bills = [] } = useQuery({
    queryKey: ["dashboard-bills"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bills").select("*").order("bill_month", { ascending: false }).limit(300);
      if (error) throw error;
      return data;
    },
  });
  const { data: repairs = [] } = useQuery({
    queryKey: ["dashboard-repairs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("repairs")
        .select("id, title, status, created_at, rooms(room_number)")
        .order("created_at", { ascending: false }).limit(6);
      if (error) throw error;
      return data;
    },
  });

  const today = dateKey(new Date());
  const monthKey = today.slice(0, 7);
  const active = rentals.filter((r) => r.status === "active");
  const dailyTenants = active.filter((r) => r.rental_type === "daily");
  const monthlyTenants = active.filter((r) => r.rental_type === "monthly");
  const billsThisMonth = bills.filter((b) => b.bill_month.slice(0, 7) === monthKey);
  const paidThisMonth = billsThisMonth.filter((b) => b.status === "paid").reduce((sum, b) => sum + Number(b.total), 0);
  const billedThisMonth = billsThisMonth.reduce((sum, b) => sum + Number(b.total), 0);
  const outstandingThisMonth = billsThisMonth.filter((b) => b.status !== "paid").reduce((sum, b) => sum + Number(b.total), 0);
  const dailyStartedToday = dailyTenants.filter((r) => r.check_in.slice(0, 10) === today).reduce((sum, r) => sum + Number(r.rate), 0);
  const pendingRepairs = repairs.filter((r) => r.status === "pending" || r.status === "in_progress").length;

  const monthlyExpected = monthlyTenants.reduce((sum, r) => sum + Number(r.rate), 0);
  const stats = [
    { label: "ผู้เช่ารายวันปัจจุบัน", value: `${dailyTenants.length} คน`, note: "รายการเช่ารายวันที่ยังใช้งาน", icon: CalendarDays, gradient: "from-sky-500 to-cyan-400", href: "/tenants/daily" },
    { label: "ผู้เช่ารายเดือน", value: `${monthlyTenants.length} คน`, note: "สัญญาเช่าที่กำลังใช้งาน", icon: Users, gradient: "from-emerald-500 to-teal-400", href: "/tenants/monthly" },
    { label: "ค่าเช่ารายวัน (เริ่มวันนี้)", value: baht(dailyStartedToday), note: "รวมรายการที่เริ่มเข้าพักวันนี้", icon: CalendarDays, gradient: "from-rose-500 to-pink-400", href: "/tenants/daily" },
    { label: "ค่าเช่ารายเดือนตามสัญญา", value: baht(monthlyExpected), note: "รวมสัญญารายเดือนที่ใช้งาน", icon: Wallet, gradient: "from-amber-500 to-orange-400", href: "/tenants/monthly" },
    { label: "รับชำระแล้วเดือนนี้", value: baht(paidThisMonth), note: `ยอดค้าง ${baht(outstandingThisMonth)}`, icon: ReceiptText, gradient: "from-indigo-500 to-blue-400", href: "/bills" },
    { label: "รายการแจ้งซ่อม", value: `${pendingRepairs} รายการ`, note: "ในรายการแจ้งซ่อมล่าสุด", icon: Wrench, gradient: "from-slate-500 to-slate-400", href: "/repairs" },
  ] as const;

  const chartData = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (5 - index));
    const key = dateKey(date).slice(0, 7);
    const monthBills = bills.filter((b) => b.bill_month.slice(0, 7) === key);
    return {
      month: date.toLocaleDateString("th-TH", { month: "short", year: "2-digit" }),
      billed: monthBills.reduce((sum, b) => sum + Number(b.total), 0),
      received: monthBills.filter((b) => b.status === "paid").reduce((sum, b) => sum + Number(b.total), 0),
    };
  });

  const roomCounts = [
    { key: "vacant", label: "ห้องว่าง", count: rooms.filter((r) => r.status === "vacant").length, icon: DoorOpen, color: "text-emerald-600" },
    { key: "occupied", label: "มีผู้เช่า", count: rooms.filter((r) => r.status === "occupied").length, icon: Users, color: "text-sky-600" },
    { key: "maintenance", label: "ปิดซ่อม", count: rooms.filter((r) => r.status === "maintenance").length, icon: Wrench, color: "text-amber-500" },
    { key: "all", label: "ห้องทั้งหมด", count: rooms.length, icon: BedDouble, color: "text-indigo-600" },
  ];

  const recentDaily = dailyTenants.slice(0, 5);
  const recentMonthly = monthlyTenants.slice(0, 5);

  return (
    <div className="space-y-5">
      <PageHeader title="แดชบอร์ด" sub={`ภาพรวมการดำเนินงาน · ${thDate(new Date().toISOString())}`} />
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {stats.map((stat) => (
          <Link key={stat.label} to={stat.href} className={cn(
            "group relative min-h-[116px] overflow-hidden rounded-2xl bg-gradient-to-br p-4 text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg",
            stat.gradient,
          )}>
            <div className="absolute -right-3 -top-4 flex h-24 w-24 items-center justify-center rounded-full bg-white/15">
              <stat.icon className="h-9 w-9 text-white/80" />
            </div>
            <p className="relative z-10 text-xs font-semibold text-white/90">{stat.label}</p>
            <p className="relative z-10 mt-2 text-2xl font-bold tracking-tight">{stat.value}</p>
            <p className="relative z-10 mt-1 text-[11px] text-white/75">{stat.note}</p>
            <ArrowUpRight className="absolute bottom-3 right-3 h-4 w-4 opacity-0 transition group-hover:opacity-80" />
          </Link>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1.04fr]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/70 px-5 py-3">
            <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-[#1b3b61]">
              <BedDouble className="h-4 w-4" /> สถานะห้องพัก
            </h3>
            <Link to="/rooms" className="text-xs font-medium text-blue-700 hover:underline">จัดการห้องพัก</Link>
          </div>
          <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
            {roomCounts.map((item) => (
              <div key={item.key} className="flex flex-col items-center rounded-xl bg-slate-50/80 px-2 py-5 text-center">
                <item.icon className={cn("h-7 w-7", item.color)} />
                <p className={cn("mt-3 font-display text-3xl font-semibold", item.color)}>
                  {roomsLoading ? "—" : item.count}
                </p>
                <p className="mt-1 text-xs text-slate-500">{item.label}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-100 px-5 py-3">
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="flex h-full">
                <div className="bg-emerald-500" style={{ width: `${rooms.length ? roomCounts[0].count / rooms.length * 100 : 0}%` }} />
                <div className="bg-sky-500" style={{ width: `${rooms.length ? roomCounts[1].count / rooms.length * 100 : 0}%` }} />
                <div className="bg-amber-400" style={{ width: `${rooms.length ? roomCounts[2].count / rooms.length * 100 : 0}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/70 px-5 py-3">
            <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-[#1b3b61]">
              <Wallet className="h-4 w-4" /> รายรับย้อนหลัง 6 เดือน
            </h3>
            <Link to="/reports" className="text-xs font-medium text-blue-700 hover:underline">ดูรายงาน</Link>
          </div>
          <div className="h-[245px] px-2 pb-3 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 15, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8edf4" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#718096" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#718096" }} axisLine={false} tickLine={false} tickFormatter={(value: number) => value === 0 ? "0" : money(value)} width={58} />
                <Tooltip formatter={(value: number | string) => baht(Number(value))} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                <Line type="monotone" dataKey="billed" name="ยอดเรียกเก็บ" stroke="#0ea5e9" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="received" name="รับชำระแล้ว" stroke="#fb7185" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/70 px-5 py-3">
            <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-[#1b3b61]"><CalendarDays className="h-4 w-4" /> ผู้เช่ารายวันล่าสุด</h3>
            <Link to="/tenants/daily" className="rounded-lg bg-[#1d3b64] px-3 py-1.5 text-xs text-white hover:bg-[#102b50]">ดูทั้งหมด</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-xs">
              <thead className="bg-slate-50 text-slate-600"><tr><th className="px-4 py-3 font-semibold">ห้อง</th><th className="px-4 py-3 font-semibold">ชื่อผู้เช่า</th><th className="px-4 py-3 font-semibold">วันเข้าพัก</th><th className="px-4 py-3 text-right font-semibold">ราคา</th><th className="px-4 py-3 font-semibold">สถานะ</th></tr></thead>
              <tbody>
                {recentDaily.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">ยังไม่มีผู้เช่ารายวัน</td></tr> : recentDaily.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-semibold text-slate-700">{r.rooms?.room_number ?? "—"}</td><td className="px-4 py-3">{r.tenant_name}</td><td className="px-4 py-3 text-slate-500">{thDate(r.check_in)}</td><td className="px-4 py-3 text-right font-medium">{baht(r.rate)}</td><td className="px-4 py-3"><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700">กำลังเข้าพัก</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/70 px-5 py-3">
            <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-[#1b3b61]"><Users className="h-4 w-4" /> ผู้เช่ารายเดือนล่าสุด</h3>
            <Link to="/tenants/monthly" className="rounded-lg bg-[#1d3b64] px-3 py-1.5 text-xs text-white hover:bg-[#102b50]">ดูทั้งหมด</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-xs">
              <thead className="bg-slate-50 text-slate-600"><tr><th className="px-4 py-3 font-semibold">ห้อง</th><th className="px-4 py-3 font-semibold">ชื่อผู้เช่า</th><th className="px-4 py-3 font-semibold">วันเริ่มสัญญา</th><th className="px-4 py-3 text-right font-semibold">ค่าเช่า/เดือน</th><th className="px-4 py-3 font-semibold">สถานะ</th></tr></thead>
              <tbody>
                {recentMonthly.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">ยังไม่มีผู้เช่ารายเดือน</td></tr> : recentMonthly.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-semibold text-slate-700">{r.rooms?.room_number ?? "—"}</td><td className="px-4 py-3">{r.tenant_name}</td><td className="px-4 py-3 text-slate-500">{thDate(r.check_in)}</td><td className="px-4 py-3 text-right font-medium">{baht(r.rate)}</td><td className="px-4 py-3"><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700">สัญญากำลังใช้งาน</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/70 px-5 py-3">
          <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-[#1b3b61]"><Wrench className="h-4 w-4" /> รายการแจ้งซ่อมล่าสุด</h3>
          <Link to="/repairs" className="text-xs font-medium text-blue-700 hover:underline">จัดการงานซ่อม</Link>
        </div>
        <div className="grid gap-2 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {repairs.length === 0 ? <p className="col-span-full py-5 text-center text-xs text-slate-400">ยังไม่มีรายการแจ้งซ่อม</p> : repairs.map((repair) => (
            <div key={repair.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600"><Wrench className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-slate-700">{repair.title}</p>
                <p className="mt-1 text-[10px] text-slate-400">ห้อง {repair.rooms?.room_number ?? "—"} · {thDate(repair.created_at)}</p>
              </div>
              <span className={cn("shrink-0 rounded-full px-2 py-1 text-[10px] font-medium", repair.status === "completed" ? "bg-emerald-50 text-emerald-700" : repair.status === "in_progress" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700")}>{repairStatus[repair.status] ?? repair.status}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
