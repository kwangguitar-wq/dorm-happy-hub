import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LogOut, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { baht, nightsBetween, rentalsQuery, roomsQuery, thDate } from "@/lib/dorm";

export function RentalsManager({ type }: { type: "daily" | "monthly" }) {
  const { data: rentals = [] } = useQuery(rentalsQuery(type));
  const { data: rooms = [] } = useQuery(roomsQuery);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"active" | "completed">("active");
  const [roomId, setRoomId] = useState("");
  const isDaily = type === "daily";
  const vacant = rooms.filter((r) => r.status === "vacant");
  const selectedRoom = rooms.find((r) => r.id === roomId);

  const list = rentals.filter(
    (r) =>
      r.status === tab &&
      (r.tenant_name.includes(q) || (r.phone ?? "").includes(q) || (r.rooms?.room_number ?? "").includes(q)),
  );

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["rentals"] });
    qc.invalidateQueries({ queryKey: ["rooms"] });
  };

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const room_id = String(f.get("room_id"));
    if (!room_id) { toast.error("กรุณาเลือกห้องพัก"); return; }
    const { data: currentRoom, error: roomError } = await supabase.from("rooms").select("status").eq("id", room_id).maybeSingle();
    if (roomError || !currentRoom) { toast.error("ตรวจสอบห้องพักไม่สำเร็จ"); return; }
    if (currentRoom.status !== "vacant") { toast.error("ห้องนี้ไม่ว่างแล้ว กรุณาเลือกห้องอื่น"); refresh(); return; }
    const { data: activeInRoom, error: activeError } = await supabase.from("rentals").select("id").eq("room_id", room_id).eq("status", "active").limit(1);
    if (activeError) { toast.error("ตรวจสอบผู้เช่าปัจจุบันไม่สำเร็จ"); return; }
    if (activeInRoom?.length) { toast.error("ห้องนี้มีผู้เช่าอยู่แล้ว กรุณาตรวจสอบข้อมูลห้องพัก"); refresh(); return; }
    const { error } = await supabase.from("rentals").insert({
      room_id,
      rental_type: type,
      tenant_name: String(f.get("tenant_name")),
      phone: String(f.get("phone") || "") || null,
      id_card: String(f.get("id_card") || "") || null,
      email: String(f.get("email") || "") || null,
      check_in: String(f.get("check_in")),
      check_out: String(f.get("check_out") || "") || null,
      rate: Number(f.get("rate")),
      deposit: Number(f.get("deposit") || 0),
      notes: String(f.get("notes") || "") || null,
    });
    if (error) { toast.error(error.message); return; }
    await supabase.from("rooms").update({ status: "occupied" }).eq("id", room_id);
    toast.success("เพิ่มผู้เช่าแล้ว");
    setOpen(false);
    setRoomId("");
    refresh();
  }

  async function checkout(id: string, room_id: string) {
    if (!confirm("ยืนยันการย้ายออก/เช็คเอาท์?")) return;
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("rentals").update({ status: "completed", check_out: today }).eq("id", id).eq("status", "active");
    if (error) { toast.error(`ย้ายออกไม่สำเร็จ: ${error.message}`); return; }
    const { data: otherActive, error: checkError } = await supabase.from("rentals").select("id").eq("room_id", room_id).eq("status", "active").limit(1);
    if (checkError) { toast.error(`บันทึกการย้ายออกแล้ว แต่ตรวจสอบสถานะห้องไม่สำเร็จ: ${checkError.message}`); refresh(); return; }
    const { error: roomUpdateError } = await supabase.from("rooms").update({ status: otherActive?.length ? "occupied" : "vacant" }).eq("id", room_id);
    if (roomUpdateError) { toast.error(`บันทึกการย้ายออกแล้ว แต่ปรับสถานะห้องไม่สำเร็จ: ${roomUpdateError.message}`); refresh(); return; }
    toast.success("บันทึกการย้ายออกแล้ว");
    refresh();
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        title={isDaily ? "ผู้เช่ารายวัน" : "ผู้เช่ารายเดือน"}
        sub={`พักอยู่ ${rentals.filter((r) => r.status === "active").length} ราย`}
        action={
          <Button onClick={() => setOpen(true)} disabled={!vacant.length}>
            <Plus /> {isDaily ? "เช็คอิน" : "เพิ่มผู้เช่า"}
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="ค้นหาชื่อ เบอร์ หรือเลขห้อง" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex rounded-lg border p-1">
          {(["active", "completed"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1 text-sm ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {t === "active" ? "กำลังพัก" : "ออกแล้ว"}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">ยังไม่มีข้อมูล</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((r) => {
            const nights = nightsBetween(r.check_in, r.check_out);
            return (
              <div key={r.id} className="rounded-xl border bg-card p-4 shadow-soft">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{r.tenant_name}</p>
                    <p className="text-sm text-muted-foreground">{r.phone ?? "-"}</p>
                  </div>
                  <Badge>ห้อง {r.rooms?.room_number}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-1 text-sm">
                  <span className="text-muted-foreground">เข้า</span>
                  <span>{thDate(r.check_in)}</span>
                  <span className="text-muted-foreground">{isDaily ? "ออก" : "สิ้นสุดสัญญา"}</span>
                  <span>{thDate(r.check_out)}</span>
                  <span className="text-muted-foreground">{isDaily ? `ค่าห้อง (${nights} คืน)` : "ค่าเช่า/เดือน"}</span>
                  <span className="font-medium">{baht(isDaily ? Number(r.rate) * nights : r.rate)}</span>
                  {!isDaily && (
                    <>
                      <span className="text-muted-foreground">เงินประกัน</span>
                      <span>{baht(r.deposit)}</span>
                    </>
                  )}
                </div>
                {r.status === "active" && (
                  <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => checkout(r.id, r.room_id)}>
                    <LogOut /> {isDaily ? "เช็คเอาท์" : "ย้ายออก"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isDaily ? "เช็คอินผู้เช่ารายวัน" : "เพิ่มผู้เช่ารายเดือน"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={create} className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>ห้อง (ว่าง)</Label>
              <select
                name="room_id"
                required
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value="">เลือกห้อง</option>
                {vacant.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.room_number} · {r.room_type}
                  </option>
                ))}
              </select>
            </div>
            <F label="ชื่อ-นามสกุล" name="tenant_name" required className="col-span-2" />
            <F label="เบอร์โทร" name="phone" type="tel" />
            <F label="เลขบัตรประชาชน" name="id_card" />
            <F label="อีเมล" name="email" type="email" className="col-span-2" />
            <F label="วันที่เข้า" name="check_in" type="date" defaultValue={today} required />
            <F label={isDaily ? "วันที่ออก" : "สิ้นสุดสัญญา"} name="check_out" type="date" required={isDaily} />
            <F
              key={roomId}
              label={isDaily ? "ราคา/คืน" : "ค่าเช่า/เดือน"}
              name="rate"
              type="number"
              required
              defaultValue={selectedRoom ? (isDaily ? selectedRoom.daily_rate : selectedRoom.monthly_rate) : ""}
            />
            <F label="เงินประกัน" name="deposit" type="number" defaultValue={0} />
            <div className="col-span-2 space-y-1.5">
              <Label>หมายเหตุ</Label>
              <Textarea name="notes" rows={2} />
            </div>
            <Button type="submit" className="col-span-2">
              บันทึก
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function F({ label, className, ...props }: { label: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label htmlFor={props.name}>{label}</Label>
      <Input id={props.name} {...props} />
    </div>
  );
}
