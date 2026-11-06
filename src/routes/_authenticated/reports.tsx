import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { baht } from "@/lib/dorm";
import { units } from "@/lib/billing";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [
    { title: "รายงาน — หอพักแม่ปะ 409" },
    { name: "description", content: "สรุปรายรับ ยอดค้าง และการใช้น้ำไฟของหอพักแม่ปะ 409" },
    { property: "og:title", content: "รายงาน — หอพักแม่ปะ 409" },
    { property: "og:description", content: "สรุปรายรับ ยอดค้าง และการใช้น้ำไฟ" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Reports,
});

function Reports() {
  const [year, setYear] = useState(new Date().getFullYear());
  const { data: bills = [] } = useQuery({
    queryKey: ["report-bills", year],
    queryFn: async () => {
      const { data, error } = await supabase.from("bills").select("*, rooms(room_number)")
        .gte("bill_month", `${year}-01-01`).lte("bill_month", `${year}-12-31`);
      if (error) throw error;
      return data;
    },
  });
  const months = Array.from({ length: 12 }, (_, i) => {
    const list = bills.filter((b) => new Date(b.bill_month).getMonth() === i);
    const paid = list.filter((b) => b.status === "paid");
    return {
      i, count: list.length,
      billed: list.reduce((s, b) => s + Number(b.total), 0),
      paid: paid.reduce((s, b) => s + Number(b.total), 0),
      water: list.reduce((s, b) => s + units(Number(b.water_prev), Number(b.water_curr)), 0),
      elec: list.reduce((s, b) => s + units(Number(b.electric_prev), Number(b.electric_curr)), 0),
    };
  });
  const sum = (k: "billed" | "paid") => months.reduce((s, m) => s + m[k], 0);
  const unpaid = bills.filter((b) => b.status !== "paid");

  return (
    <>
      <PageHeader title="รายงานผล" sub="สรุปรายรับและค่าน้ำ/ไฟรายเดือน"
        action={<select value={year} onChange={(e) => setYear(Number(e.target.value))} className="h-9 rounded-md border bg-background px-2 text-sm">
          {[0, 1, 2].map((d) => { const y = new Date().getFullYear() - d; return <option key={y} value={y}>{y + 543}</option>; })}
        </select>} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[["ยอดเรียกเก็บ", sum("billed")], ["รับชำระแล้ว", sum("paid")], ["ค้างชำระ", sum("billed") - sum("paid")]].map(([l, v]) => (
          <div key={l as string} className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">{l}</p>
            <p className="mt-1 font-display text-2xl font-semibold">{baht(v as number)}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left"><tr>
            <th className="p-3">เดือน</th><th className="p-3 text-right">บิล</th><th className="p-3 text-right">น้ำ (หน่วย)</th>
            <th className="p-3 text-right">ไฟ (หน่วย)</th><th className="p-3 text-right">เรียกเก็บ</th><th className="p-3 text-right">ชำระแล้ว</th>
          </tr></thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.i} className="border-t">
                <td className="p-3">{new Date(year, m.i, 1).toLocaleDateString("th-TH", { month: "long" })}</td>
                <td className="p-3 text-right">{m.count}</td><td className="p-3 text-right">{m.water}</td>
                <td className="p-3 text-right">{m.elec}</td><td className="p-3 text-right">{baht(m.billed)}</td>
                <td className="p-3 text-right">{baht(m.paid)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 className="mb-3 mt-8 text-lg font-semibold">บิลค้างชำระ</h3>
      {unpaid.length === 0 ? <p className="text-sm text-muted-foreground">ไม่มีบิลค้างชำระ</p> : (
        <div className="space-y-2">
          {unpaid.map((b) => (
            <div key={b.id} className="flex justify-between rounded-lg border bg-card p-3 text-sm">
              <span>ห้อง {b.rooms?.room_number} · {new Date(b.bill_month).toLocaleDateString("th-TH", { month: "short", year: "numeric" })}</span>
              <span className="font-semibold">{baht(b.total)}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
