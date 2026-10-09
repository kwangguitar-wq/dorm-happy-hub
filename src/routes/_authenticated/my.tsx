import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { baht, meQuery, rentalsQuery, thDate } from "@/lib/dorm";

export const Route = createFileRoute("/_authenticated/my")({
  head: () => ({ meta: [{ title: "ห้องของฉัน — บาบรีส แม่ปะ" }] }),
  component: MyRoom,
});

function MyRoom() {
  const { data: me } = useQuery(meQuery);
  const { data: rentals = [] } = useQuery(rentalsQuery());
  const mine = rentals.filter((r) => r.status === "active");

  return (
    <>
      <PageHeader title={`สวัสดี ${me?.name ?? ""}`} sub="ข้อมูลการเช่าของคุณ" />
      {mine.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          ยังไม่ได้ผูกบัญชีกับห้องพัก กรุณาติดต่อเจ้าหน้าที่หอพัก
        </p>
      ) : (
        mine.map((r) => (
          <div key={r.id} className="rounded-xl bg-hero p-6 text-primary-foreground">
            <p className="text-sm opacity-80">ห้องพัก</p>
            <p className="font-display text-4xl font-semibold">{r.rooms?.room_number}</p>
            <p className="mt-4 text-sm">เข้าพัก {thDate(r.check_in)}</p>
            <p className="text-sm">ค่าเช่า {baht(r.rate)}{r.rental_type === "monthly" ? " / เดือน" : " / คืน"}</p>
          </div>
        ))
      )}
    </>
  );
}
