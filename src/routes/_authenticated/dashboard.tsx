import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BedDouble, CalendarDays, Users, Wrench } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { baht, rentalsQuery, roomsQuery, roomStatusLabel, thDate } from "@/lib/dorm";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "แดชบอร์ด — บาบรีส แม่ปะ" }] }),
  component: Dashboard,
});

const statusClass: Record<string, string> = {
  vacant: "bg-success/15 text-success border-success/30",
  occupied: "bg-primary/10 text-primary border-primary/30",
  maintenance: "bg-warning/20 text-warning-foreground border-warning/40",
};

function Dashboard() {
  const { data: rooms = [] } = useQuery(roomsQuery);
  const { data: rentals = [] } = useQuery(rentalsQuery());
  const active = rentals.filter((r) => r.status === "active");
  const monthlyIncome = active.filter((r) => r.rental_type === "monthly").reduce((s, r) => s + Number(r.rate), 0);

  const stats = [
    { label: "ห้องทั้งหมด", value: rooms.length, icon: BedDouble },
    { label: "ห้องว่าง", value: rooms.filter((r) => r.status === "vacant").length, icon: BedDouble },
    { label: "ผู้เช่ารายเดือน", value: active.filter((r) => r.rental_type === "monthly").length, icon: Users },
    { label: "ผู้เช่ารายวัน", value: active.filter((r) => r.rental_type === "daily").length, icon: CalendarDays },
  ];

  return (
    <>
      <PageHeader title="แดชบอร์ด" sub={`ภาพรวมวันที่ ${thDate(new Date().toISOString())}`} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4 shadow-soft">
            <s.icon className="h-5 w-5 text-accent" />
            <p className="mt-3 text-3xl font-semibold font-display">{s.value}</p>
            <p className="text-sm text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl bg-hero p-5 text-primary-foreground">
        <p className="text-sm opacity-80">ค่าเช่ารายเดือนที่คาดว่าจะได้รับ</p>
        <p className="mt-1 text-3xl font-semibold font-display">{baht(monthlyIncome)}</p>
      </div>

      <h3 className="mb-3 mt-8 text-lg font-semibold">ผังห้องพัก</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {rooms.map((room) => {
          const tenant = active.find((r) => r.room_id === room.id);
          return (
            <Link
              key={room.id}
              to="/rooms"
              className={cn("rounded-xl border p-4 transition hover:-translate-y-0.5", statusClass[room.status])}
            >
              <p className="font-display text-2xl font-semibold">{room.room_number}</p>
              <p className="text-xs font-medium">{roomStatusLabel[room.status]}</p>
              <p className="mt-2 truncate text-xs opacity-80">{tenant?.tenant_name ?? room.room_type}</p>
              {room.status === "maintenance" && <Wrench className="mt-1 h-3.5 w-3.5" />}
            </Link>
          );
        })}
      </div>
    </>
  );
}
