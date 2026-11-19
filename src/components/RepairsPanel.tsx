import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { thDate } from "@/lib/dorm";
import { Field } from "@/routes/_authenticated/rooms";
import { notifyLine } from "@/lib/line-notifications";

export const repairStatus: Record<string, { label: string; v: "default" | "secondary" | "outline" }> = {
  pending: { label: "รอดำเนินการ", v: "secondary" },
  in_progress: { label: "กำลังซ่อม", v: "outline" },
  completed: { label: "เสร็จสิ้น", v: "default" },
};

export function RepairsPanel({ staff, roomId }: { staff: boolean; roomId?: string | null }) {
  const qc = useQueryClient();
  const { data: list = [] } = useQuery({
    queryKey: ["repairs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("repairs").select("*, rooms(room_number)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const [open, setOpen] = useState(false);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("repairs").insert({
      title: String(f.get("title")), detail: String(f.get("detail") || "") || null,
      room_id: roomId ?? null, tenant_user_id: u.user!.id,
    });
    if (error) { toast.error(error.message); return; }
    const notice = await notifyLine("repair_created", "มีรายการแจ้งซ่อมใหม่", `${String(f.get("title"))}${f.get("detail") ? ` · ${String(f.get("detail"))}` : ""}`);
    toast.success("ส่งแจ้งซ่อมแล้ว");
    if (!notice.ok) toast.warning(`บันทึกแจ้งซ่อมแล้ว แต่ส่ง LINE ไม่สำเร็จ: ${notice.message}`);
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["repairs"] });
  }

  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from("repairs").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    const repair = list.find((item) => item.id === id);
    if (repair?.tenant_user_id) {
      const label = repairStatus[status]?.label ?? status;
      const notice = await notifyLine("repair_status_changed", "อัปเดตสถานะการแจ้งซ่อม", `${repair.title} · สถานะใหม่: ${label}`, repair.tenant_user_id);
      if (!notice.ok) toast.warning(`เปลี่ยนสถานะแล้ว แต่ส่ง LINE ไม่สำเร็จ: ${notice.message}`);
    }
    qc.invalidateQueries({ queryKey: ["repairs"] });
  }

  return (
    <>
      {!staff && <Button className="mb-3" onClick={() => setOpen(true)}><Plus /> แจ้งซ่อม</Button>}
      <div className="space-y-3">
        {list.length === 0 && <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">ยังไม่มีรายการแจ้งซ่อม</p>}
        {list.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
            <div>
              <p className="font-semibold">{r.rooms ? `ห้อง ${r.rooms.room_number} · ` : ""}{r.title}</p>
              {r.detail && <p className="text-sm">{r.detail}</p>}
              <p className="text-xs text-muted-foreground">แจ้งเมื่อ {thDate(r.created_at)}</p>
            </div>
            {staff ? (
              <select value={r.status} onChange={(e) => setStatus(r.id, e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
                {Object.entries(repairStatus).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
              </select>
            ) : (
              <Badge variant={repairStatus[r.status]?.v}>{repairStatus[r.status]?.label}</Badge>
            )}
          </div>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>แจ้งซ่อม</DialogTitle></DialogHeader>
          <form onSubmit={create} className="space-y-3">
            <Field label="เรื่อง" name="title" placeholder="เช่น แอร์ไม่เย็น, ก๊อกน้ำรั่ว" required />
            <Field label="รายละเอียด" name="detail" />
            <Button type="submit" className="w-full">ส่งแจ้งซ่อม</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
