import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Image, ScanLine, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { baht, thDate } from "@/lib/dorm";
import { units } from "@/lib/billing";
import { readSlipWithAIFn } from "@/lib/slip-reader.functions";

export const Route = createFileRoute("/_authenticated/payments")({
  head: () => ({ meta: [{ title: "ตรวจสอบการชำระเงิน — แม่ปะ 409" }] }),
  component: PaymentsPage,
});

export const payStatus: Record<string, { label: string; v: "default" | "secondary" | "destructive" }> = {
  pending: { label: "รอตรวจสอบ", v: "secondary" },
  approved: { label: "ยืนยันแล้ว", v: "default" },
  rejected: { label: "ไม่ผ่าน", v: "destructive" },
};

type AiRead = {
  loading: boolean;
  amount?: number | null;
  paid_on?: string | null;
  bank?: string | null;
  error?: string;
};

function PaymentsPage() {
  const qc = useQueryClient();
  const [ai, setAi] = useState<Record<string, AiRead>>({});
  const { data: list = [] } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments").select("*, bills(id, bill_month, total, receipt_no, rent, water_prev, water_curr, electric_prev, electric_curr, water_rate, electric_rate, other_fee, other_note, rooms(room_number))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function viewSlip(path: string) {
    const { data, error } = await supabase.storage.from("slips").createSignedUrl(path, 300);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, "_blank");
  }

  async function review(p: (typeof list)[number], ok: boolean) {
    const { error } = await supabase.from("payments")
      .update({ status: ok ? "approved" : "rejected", reviewed_at: new Date().toISOString() }).eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    if (ok && p.bills) {
      const { error: e2 } = await supabase.rpc("mark_bill_paid", { _bill_id: p.bills.id });
      if (e2) { toast.error(e2.message); return; }
    }
    toast.success(ok ? "ยืนยันการชำระแล้ว" : "ปฏิเสธรายการแล้ว");
    qc.invalidateQueries({ queryKey: ["payments"] });
    qc.invalidateQueries({ queryKey: ["bills"] });
  }

  return (
    <>
      <PageHeader title="ตรวจสอบการชำระเงิน" sub={`รอตรวจสอบ ${list.filter((p) => p.status === "pending").length} รายการ`} />
      <div className="space-y-3">
        {list.length === 0 && <p className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">ยังไม่มีการแจ้งชำระ</p>}
        {list.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
            <div>
              <p className="font-semibold">
                ห้อง {p.bills?.rooms?.room_number} · {p.bills && new Date(p.bills.bill_month).toLocaleDateString("th-TH", { month: "long", year: "numeric" })}
              </p>
              <p className="text-sm text-muted-foreground">
                โอน {baht(p.amount)} (ยอดบิล {baht(p.bills?.total)}) · วันที่ {thDate(p.paid_on)}
              </p>
              {p.bills && (
                <p className="text-xs text-muted-foreground">
                  ค่าเช่า {baht(p.bills.rent)} · ค่าน้ำ {units(p.bills.water_prev, p.bills.water_curr)} หน่วย ({baht(units(p.bills.water_prev, p.bills.water_curr) * p.bills.water_rate)}) · ค่าไฟ {units(p.bills.electric_prev, p.bills.electric_curr)} หน่วย ({baht(units(p.bills.electric_prev, p.bills.electric_curr) * p.bills.electric_rate)})
                  {Number(p.bills.other_fee) > 0 ? ` · ค่าอื่นๆ${p.bills.other_note ? ` (${p.bills.other_note})` : ""} ${baht(p.bills.other_fee)}` : ""}
                </p>
              )}
              {p.note && <p className="text-sm">{p.note}</p>}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={payStatus[p.status]?.v}>{payStatus[p.status]?.label}</Badge>
              {p.slip_path && <Button size="sm" variant="outline" onClick={() => viewSlip(p.slip_path!)}><Image /> สลิป</Button>}
              {p.status === "pending" && (
                <>
                  <Button size="sm" onClick={() => review(p, true)}><Check /> ยืนยัน</Button>
                  <Button size="sm" variant="ghost" onClick={() => review(p, false)}><X /> ปฏิเสธ</Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
