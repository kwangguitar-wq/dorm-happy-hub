import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { baht, roomsQuery, roomStatusLabel, type Room } from "@/lib/dorm";

export const Route = createFileRoute("/_authenticated/rooms")({
  head: () => ({ meta: [{ title: "ห้องพัก — บาบรีส แม่ปะ" }] }),
  component: RoomsPage,
});

function RoomsPage() {
  const { data: rooms = [] } = useQuery(roomsQuery);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Room> | null>(null);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const row = {
      room_number: String(f.get("room_number")),
      floor: Number(f.get("floor")),
      room_type: String(f.get("room_type")),
      monthly_rate: Number(f.get("monthly_rate")),
      daily_rate: Number(f.get("daily_rate")),
      status: String(f.get("status")),
    };
    const { error } = editing?.id
      ? await supabase.from("rooms").update(row).eq("id", editing.id)
      : await supabase.from("rooms").insert(row);
    if (error) { toast.error(error.message); return; }
    toast.success("บันทึกแล้ว");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["rooms"] });
  }

  return (
    <>
      <PageHeader
        title="ห้องพัก"
        sub={`${rooms.length} ห้อง`}
        action={
          <Button onClick={() => setEditing({})}>
            <Plus /> เพิ่มห้อง
          </Button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rooms.map((r) => (
          <div key={r.id} className="rounded-xl border bg-card p-5 shadow-soft">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-display text-2xl font-semibold">ห้อง {r.room_number}</p>
                <p className="text-sm text-muted-foreground">
                  ชั้น {r.floor} · {r.room_type}
                </p>
              </div>
              <Badge variant={r.status === "vacant" ? "secondary" : "default"}>{roomStatusLabel[r.status]}</Badge>
            </div>
            <div className="mt-4 flex justify-between text-sm">
              <span>รายเดือน {baht(r.monthly_rate)}</span>
              <span>รายวัน {baht(r.daily_rate)}</span>
            </div>
            <Button variant="outline" size="sm" className="mt-4 w-full" onClick={() => setEditing(r)}>
              <Pencil /> แก้ไข
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "แก้ไขห้อง" : "เพิ่มห้อง"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="grid grid-cols-2 gap-3">
            <Field label="เลขห้อง" name="room_number" defaultValue={editing?.room_number} required />
            <Field label="ชั้น" name="floor" type="number" defaultValue={editing?.floor ?? 1} />
            <Field label="ประเภท" name="room_type" defaultValue={editing?.room_type ?? "มาตรฐาน"} />
            <div className="space-y-1.5">
              <Label>สถานะ</Label>
              <select
                name="status"
                defaultValue={editing?.status ?? "vacant"}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              >
                {Object.entries(roomStatusLabel).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <Field label="ค่าเช่ารายเดือน" name="monthly_rate" type="number" defaultValue={editing?.monthly_rate ?? 0} />
            <Field label="ค่าเช่ารายวัน" name="daily_rate" type="number" defaultValue={editing?.daily_rate ?? 0} />
            <Button type="submit" className="col-span-2">
              บันทึก
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={props.name}>{label}</Label>
      <Input id={props.name} {...props} />
    </div>
  );
}
