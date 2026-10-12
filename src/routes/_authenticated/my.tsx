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
import { Field } from "./rooms";
import { payStatus } from "./payments";
import { RepairsPanel } from "@/components/RepairsPanel";

export const Route = createFileRoute("/_authenticated/my")({
  head: () => ({ meta: [{ title: "ห้องของฉัน — บาบรีส แม่ปะ" }] }),
  component: MyRoom,
});

function MyRoom() {
  const qc = useQueryClient();
  const { data: me } = useQuery(meQuery);
  const { data: rentals = [] } = useQuery(rentalsQuery());
  const mine = rentals.filter((r) => r.status === "active");
  const { data: bills = [] } = useQuery({
    queryKey: ["my-bills"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bills")
        .select("*, rooms(room_number), payments(id, status, created_at)").order("bill_month", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const [bill, setBill] = useState<(typeof bills)[number] | null>(null);
  const [busy, setBusy] = useState(false);

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
    toast.success("ส่งแจ้งชำระแล้ว รอเจ้าหน้าที่ตรวจสอบ");
    setBill(null);
    qc.invalidateQueries({ queryKey: ["my-bills"] });
  }

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

      <h3 className="mb-3 mt-8 text-lg font-semibold">บิลของฉัน</h3>
      <div className="space-y-3">
        {bills.length === 0 && <p className="text-sm text-muted-foreground">ยังไม่มีบิล</p>}
        {bills.map((b) => {
          const last = [...(b.payments ?? [])].sort((a, z) => z.created_at.localeCompare(a.created_at))[0];
          const canPay = b.status !== "paid" && last?.status !== "pending";
          return (
            <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
              <div>
                <p className="font-semibold">{new Date(b.bill_month).toLocaleDateString("th-TH", { month: "long", year: "numeric" })}</p>
                <p className="text-sm text-muted-foreground">ยอด {baht(b.total)}</p>
              </div>
              <div className="flex items-center gap-2">
                {b.status === "paid" ? <Badge>ชำระแล้ว</Badge>
                  : last ? <Badge variant={payStatus[last.status]?.v}>{payStatus[last.status]?.label}</Badge>
                  : <Badge variant="secondary">ค้างชำระ</Badge>}
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
