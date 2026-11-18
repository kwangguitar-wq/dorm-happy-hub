import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { baht, meQuery, rentalsQuery, thDate } from "@/lib/dorm";
import { units } from "@/lib/billing";
import { printInvoice } from "@/lib/invoice";
import { Field } from "./rooms";
import { payStatus } from "./payments";
import { RepairsPanel } from "@/components/RepairsPanel";
import { notifyLine } from "@/lib/line-notifications";

export const Route = createFileRoute("/_authenticated/my")({
  head: () => ({ meta: [
    { title: "ห้องของฉัน — หอพักแม่ปะ 409" },
    { name: "description", content: "ดูข้อมูลห้อง บิล และแจ้งชำระเงินของผู้เช่า หอพักแม่ปะ 409" },
    { property: "og:title", content: "ห้องของฉัน — หอพักแม่ปะ 409" },
    { property: "og:description", content: "ดูข้อมูลห้อง บิล และแจ้งชำระเงินของผู้เช่า" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: MyRoom,
});

function MyRoom() {
  const qc = useQueryClient();
  const { data: me } = useQuery(meQuery);
  const { data: rentals = [] } = useQuery(rentalsQuery());
  const mine = rentals.filter((r) => r.status === "active");
  const { data: invoiceSettings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const { data: bills = [] } = useQuery({
    queryKey: ["my-bills"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bills")
        .select("*, rooms(room_number), rentals(tenant_name, phone, email), payments(id, status, created_at)")
        .order("bill_month", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const [bill, setBill] = useState<(typeof bills)[number] | null>(null);
  const [busy, setBusy] = useState(false);
  const [lineCode, setLineCode] = useState<string | null>(null);
  const [lineBusy, setLineBusy] = useState(false);

  async function createLineLinkCode() {
    setLineBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) { toast.error("กรุณาเข้าสู่ระบบใหม่"); return; }
      const res = await fetch("/api/line/link-code", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const result = await res.json() as { message?: string; code?: string; linked?: boolean };
      if (!res.ok) { toast.error(result.message ?? "สร้างรหัสไม่สำเร็จ"); return; }
      if (result.linked) { toast.success("บัญชีนี้เชื่อมต่อ LINE อยู่แล้ว"); setLineCode(null); return; }
      setLineCode(result.code ?? null);
      toast.success("สร้างรหัสเชื่อมต่อแล้ว มีอายุ 10 นาที");
    } catch { toast.error("เชื่อมต่อระบบไม่สำเร็จ"); }
    finally { setLineBusy(false); }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!bill) return;
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user!.id;
    let slip_path: string | null = null;
    const file = f.get("slip") as File | null;
    if (file && file.size > 0) {
      slip_path = `${uid}/${bill.id}-${Date.now()}.${file.name.split(".").pop()}`;
      const { error } = await supabase.storage.from("slips").upload(slip_path, file);
      if (error) { toast.error(error.message); setBusy(false); return; }
    }
    const { error } = await supabase.from("payments").insert({
      bill_id: bill.id, tenant_user_id: uid, amount: Number(f.get("amount")),
      paid_on: String(f.get("paid_on")), note: String(f.get("note") || "") || null, slip_path,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const notice = await notifyLine("payment_submitted", "มีผู้เช่าแจ้งชำระเงิน", `ห้อง ${bill.rooms?.room_number ?? "ไม่ระบุ"} · ยอด ${baht(Number(f.get("amount")))} · วันที่โอน ${String(f.get("paid_on"))}`);
    toast.success("ส่งแจ้งชำระแล้ว รอเจ้าหน้าที่ตรวจสอบ");
    if (!notice.ok) toast.warning(`บันทึกแจ้งชำระแล้ว แต่ส่ง LINE ไม่สำเร็จ: ${notice.message}`);
    setBill(null);
    qc.invalidateQueries({ queryKey: ["my-bills"] });
  }

  return (
    <>
      <PageHeader title={`สวัสดี ${me?.name ?? ""}`} sub="ข้อมูลการเช่าของคุณ" />
      <section className="mt-4 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="font-semibold">การแจ้งเตือนผ่าน LINE</h3><p className="text-sm text-muted-foreground">เชื่อมต่อ LINE ส่วนตัวกับ LINE OA ของหอพัก เพื่อรับแจ้งเตือนบิลและสถานะรายการ</p></div>
          <Button type="button" variant="outline" onClick={createLineLinkCode} disabled={lineBusy}>{lineBusy ? "กำลังสร้างรหัส..." : "เชื่อมต่อ LINE"}</Button>
        </div>
        {lineCode && <div className="mt-3 rounded-lg bg-muted p-3 text-center">
          <p className="text-sm">ส่งข้อความนี้ไปยัง LINE OA ของหอพัก</p>
          <p className="my-2 font-mono text-2xl font-bold tracking-widest">LINK {lineCode}</p>
          <Button type="button" size="sm" onClick={() => navigator.clipboard.writeText(`LINK ${lineCode}`).then(() => toast.success("คัดลอกรหัสแล้ว")).catch(() => toast.error("คัดลอกไม่สำเร็จ"))}>คัดลอกรหัส</Button>
          <p className="mt-2 text-xs text-muted-foreground">รหัสใช้ได้ครั้งเดียวและหมดอายุภายใน 10 นาที</p>
        </div>}
      </section>
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

      <h3 className="mb-3 mt-8 text-lg font-semibold">บิลของฉัน</h3>
      <div className="space-y-3">
        {bills.length === 0 && <p className="text-sm text-muted-foreground">ยังไม่มีบิล</p>}
        {bills.map((b) => {
          const last = [...(b.payments ?? [])].sort((a, z) => z.created_at.localeCompare(a.created_at))[0];
          const canPay = b.status !== "paid" && last?.status !== "pending";
          const wU = units(b.water_prev, b.water_curr);
          const eU = units(b.electric_prev, b.electric_curr);
          return (
            <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
              <div>
                <p className="font-semibold">{new Date(b.bill_month).toLocaleDateString("th-TH", { month: "long", year: "numeric" })}</p>
                <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                  <p>ค่าเช่าห้อง {baht(b.rent)}</p>
                  <p>ค่าน้ำ {wU} หน่วย × {baht(b.water_rate)} = {baht(wU * b.water_rate)}</p>
                  <p>ค่าไฟ {eU} หน่วย × {baht(b.electric_rate)} = {baht(eU * b.electric_rate)}</p>
                  {Number(b.other_fee) > 0 && (
                    <p>ค่าอื่นๆ{b.other_note ? ` (${b.other_note})` : ""} {baht(b.other_fee)}</p>
                  )}
                  <p className="font-semibold text-foreground">รวมทั้งสิ้น {baht(b.total)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {b.status === "paid" ? <Badge>ชำระแล้ว</Badge>
                  : last ? <Badge variant={payStatus[last.status]?.v}>{payStatus[last.status]?.label}</Badge>
                  : <Badge variant="secondary">ค้างชำระ</Badge>}
                {b.status !== "paid" && (
                  <Button size="sm" variant="outline" onClick={() => printInvoice(b, invoiceSettings ?? undefined)}>ใบแจ้งหนี้</Button>
                )}
                {canPay && <Button size="sm" onClick={() => setBill(b)}>แจ้งชำระ</Button>}
              </div>
            </div>
          );
        })}
      </div>

      <h3 className="mb-3 mt-8 text-lg font-semibold">แจ้งซ่อม</h3>
      <RepairsPanel staff={false} roomId={mine[0]?.room_id ?? null} />

      <Dialog open={!!bill} onOpenChange={(o) => !o && setBill(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>แจ้งชำระเงิน</DialogTitle></DialogHeader>
          {bill && (
            <div className="space-y-0.5 rounded-lg bg-muted/50 p-3 text-sm">
              <p className="font-medium">ห้อง {bill.rooms?.room_number} · {new Date(bill.bill_month).toLocaleDateString("th-TH", { month: "long", year: "numeric" })}</p>
              <p className="text-muted-foreground">
                ค่าเช่าห้อง {baht(bill.rent)} · ค่าน้ำ {units(bill.water_prev, bill.water_curr)} หน่วย ({baht(units(bill.water_prev, bill.water_curr) * bill.water_rate)}) · ค่าไฟ {units(bill.electric_prev, bill.electric_curr)} หน่วย ({baht(units(bill.electric_prev, bill.electric_curr) * bill.electric_rate)})
                {Number(bill.other_fee) > 0 ? ` · ค่าอื่นๆ${bill.other_note ? ` (${bill.other_note})` : ""} ${baht(bill.other_fee)}` : ""}
              </p>
              <p className="font-semibold">ยอดที่ต้องชำระ {baht(bill.total)}</p>
            </div>
          )}
          <form key={bill?.id} onSubmit={submit} className="grid grid-cols-2 gap-3">
            <Field label="จำนวนเงิน" name="amount" type="number" step="any" defaultValue={bill?.total ?? 0} required />
            <Field label="วันที่โอน" name="paid_on" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
            <div className="col-span-2 space-y-1.5">
              <label className="text-sm font-medium">สลิปโอนเงิน</label>
              <input name="slip" type="file" accept="image/*" className="block w-full text-sm" />
            </div>
            <div className="col-span-2"><Field label="หมายเหตุ" name="note" /></div>
            <Button type="submit" className="col-span-2" disabled={busy}>{busy ? "กำลังส่ง..." : "ส่งแจ้งชำระ"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
