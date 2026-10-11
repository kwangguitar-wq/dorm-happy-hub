import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { baht, roomsQuery } from "@/lib/dorm";
import { billTotal, units } from "@/lib/billing";
import { Field } from "./rooms";

export const Route = createFileRoute("/_authenticated/bills")({
  head: () => ({ meta: [{ title: "มิเตอร์และบิล — บาบรีส แม่ปะ" }] }),
  component: BillsPage,
});

const thisMonth = () => new Date().toISOString().slice(0, 7);

function BillsPage() {
  const qc = useQueryClient();
  const { data: rooms = [] } = useQuery(roomsQuery);
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await supabase.from("settings").select("*").eq("id", 1).maybeSingle()).data,
  });
  const { data: bills = [] } = useQuery({
    queryKey: ["bills"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bills").select("*, rooms(room_number)").order("bill_month", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const [open, setOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [roomId, setRoomId] = useState("");

  const lastBill = bills.find((b) => b.room_id === roomId);
  const room = rooms.find((r) => r.id === roomId);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const { data: rental } = await supabase
      .from("rentals").select("id, tenant_user_id, rate").eq("room_id", roomId).eq("status", "active")
      .eq("rental_type", "monthly").maybeSingle();
    const row = {
      room_id: roomId,
      rental_id: rental?.id ?? null,
      tenant_user_id: rental?.tenant_user_id ?? null,
      bill_month: `${f.get("month")}-01`,
      water_prev: Number(f.get("water_prev")),
      water_curr: Number(f.get("water_curr")),
      electric_prev: Number(f.get("electric_prev")),
      electric_curr: Number(f.get("electric_curr")),
      water_rate: Number(settings?.water_rate ?? 0),
      electric_rate: Number(settings?.electric_rate ?? 0),
      rent: Number(f.get("rent")),
    };
    const { error } = await supabase.from("bills").insert({ ...row, total: billTotal(row) });
    if (error) { toast.error(error.message.includes("duplicate") ? "ห้องนี้มีบิลเดือนนี้แล้ว" : error.message); return; }
    toast.success("สร้างบิลแล้ว");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["bills"] });
  }

  async function saveRates(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const { error } = await supabase.from("settings").upsert({
      id: 1, water_rate: Number(f.get("water_rate")), electric_rate: Number(f.get("electric_rate")),
    });
    if (error) { toast.error(error.message); return; }
    toast.success("บันทึกอัตราแล้ว");
    setRateOpen(false);
    qc.invalidateQueries({ queryKey: ["settings"] });
  }

  async function togglePaid(b: (typeof bills)[number]) {
    if (b.status === "paid") {
      await supabase.from("bills").update({ status: "unpaid", paid_at: null }).eq("id", b.id);
    } else {
      const paidCount = bills.filter((x) => x.receipt_no).length;
      const ym = b.bill_month.slice(0, 7).replace("-", "");
      const receipt_no = b.receipt_no ?? `RC${ym}-${String(paidCount + 1).padStart(4, "0")}`;
      await supabase.from("bills").update({ status: "paid", paid_at: new Date().toISOString(), receipt_no }).eq("id", b.id);
    }
    qc.invalidateQueries({ queryKey: ["bills"] });
  }

  function printReceipt(b: (typeof bills)[number]) {
    const wUnits = units(b.water_prev, b.water_curr);
    const eUnits = units(b.electric_prev, b.electric_curr);
    const row = (label: string, val: string) =>
      `<tr><td style="padding:6px 0">${label}</td><td style="text-align:right;padding:6px 0">${val}</td></tr>`;
    const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>ใบเสร็จ ${b.receipt_no}</title>
<style>body{font-family:'Sarabun',Tahoma,sans-serif;max-width:640px;margin:24px auto;color:#111;padding:0 16px}
table{width:100%;border-collapse:collapse} .line td{border-top:1px solid #ddd}
h1{font-size:22px;margin:0} .muted{color:#666;font-size:13px}
.total td{font-size:18px;font-weight:700;border-top:2px solid #111}</style></head><body>
<h1>ใบเสร็จรับเงิน</h1>
<div class="muted">ห้องพักบาบรีส แม่ปะ</div>
<p class="muted">เลขที่ ${b.receipt_no ?? "-"} · วันที่ชำระ ${b.paid_at ? new Date(b.paid_at).toLocaleDateString("th-TH", { dateStyle: "long" }) : "-"}<br>
ห้อง ${b.rooms?.room_number ?? ""} · ประจำเดือน ${new Date(b.bill_month).toLocaleDateString("th-TH", { month: "long", year: "numeric" })}</p>
<table>
${row(`ค่าเช่าห้อง`, baht(b.rent))}
${row(`ค่าน้ำ ${wUnits} หน่วย × ${baht(b.water_rate)}`, baht(wUnits * b.water_rate))}
${row(`ค่าไฟ ${eUnits} หน่วย × ${baht(b.electric_rate)}`, baht(eUnits * b.electric_rate))}
<tr class="total line"><td style="padding:10px 0">รวมทั้งสิ้น</td><td style="text-align:right;padding:10px 0">${baht(b.total)}</td></tr>
</table>
<p class="muted" style="margin-top:32px">ลงชื่อผู้รับเงิน ______________________</p>
<script>window.print()</script></body></html>`;
    const win = window.open("", "_blank", "width=720,height=800");
    if (win) { win.document.write(html); win.document.close(); }
  }

  return (
    <>
      <PageHeader
        title="มิเตอร์และบิล"
        sub={`ค่าน้ำ ${baht(settings?.water_rate)}/หน่วย · ค่าไฟ ${baht(settings?.electric_rate)}/หน่วย`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setRateOpen(true)}><Settings2 /> อัตราต่อหน่วย</Button>
            <Button onClick={() => { setRoomId(rooms[0]?.id ?? ""); setOpen(true); }}><Plus /> จดมิเตอร์/สร้างบิล</Button>
          </div>
        }
      />
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-3">เดือน</th><th className="p-3">ห้อง</th><th className="p-3">น้ำ (หน่วย)</th>
              <th className="p-3">ไฟ (หน่วย)</th><th className="p-3">ค่าเช่า</th><th className="p-3">รวม</th><th className="p-3">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {bills.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">ยังไม่มีบิล</td></tr>}
            {bills.map((b) => (
              <tr key={b.id} className="border-t">
                <td className="p-3">{new Date(b.bill_month).toLocaleDateString("th-TH", { month: "short", year: "numeric" })}</td>
                <td className="p-3">{b.rooms?.room_number}</td>
                <td className="p-3">{units(b.water_prev, b.water_curr)}</td>
                <td className="p-3">{units(b.electric_prev, b.electric_curr)}</td>
                <td className="p-3">{baht(b.rent)}</td>
                <td className="p-3 font-semibold">{baht(b.total)}</td>
                <td className="p-3">
                  <button onClick={() => togglePaid(b.id, b.status)}>
                    <Badge variant={b.status === "paid" ? "default" : "secondary"}>{b.status === "paid" ? "ชำระแล้ว" : "ค้างชำระ"}</Badge>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>จดมิเตอร์และสร้างบิล</DialogTitle></DialogHeader>
          <form key={roomId} onSubmit={create} className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <label className="text-sm font-medium">ห้อง</label>
              <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                {rooms.map((r) => <option key={r.id} value={r.id}>ห้อง {r.room_number}</option>)}
              </select>
            </div>
            <Field label="เดือน" name="month" type="month" defaultValue={thisMonth()} required />
            <Field label="ค่าเช่า" name="rent" type="number" defaultValue={room?.monthly_rate ?? 0} />
            <Field label="มิเตอร์น้ำ ครั้งก่อน" name="water_prev" type="number" step="any" defaultValue={lastBill?.water_curr ?? 0} />
            <Field label="มิเตอร์น้ำ ครั้งนี้" name="water_curr" type="number" step="any" required />
            <Field label="มิเตอร์ไฟ ครั้งก่อน" name="electric_prev" type="number" step="any" defaultValue={lastBill?.electric_curr ?? 0} />
            <Field label="มิเตอร์ไฟ ครั้งนี้" name="electric_curr" type="number" step="any" required />
            <Button type="submit" className="col-span-2">สร้างบิล</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={rateOpen} onOpenChange={setRateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>อัตราค่าน้ำ/ค่าไฟต่อหน่วย</DialogTitle></DialogHeader>
          <form onSubmit={saveRates} className="grid grid-cols-2 gap-3">
            <Field label="ค่าน้ำ (บาท/หน่วย)" name="water_rate" type="number" step="any" defaultValue={settings?.water_rate ?? 0} />
            <Field label="ค่าไฟ (บาท/หน่วย)" name="electric_rate" type="number" step="any" defaultValue={settings?.electric_rate ?? 0} />
            <Button type="submit" className="col-span-2">บันทึก</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
