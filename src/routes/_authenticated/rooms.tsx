import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pencil, Plus, Search, DoorOpen, Users, Wrench, BedDouble, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { baht, roomsQuery, roomStatusLabel, type Room } from "@/lib/dorm";

export const Route = createFileRoute("/_authenticated/rooms")({
  head: () => ({ meta: [
    { title: "ห้องพัก — หอพักแม่ปะ 409" },
    { name: "description", content: "ดูและจัดการห้องพักและค่าเช่าของหอพักแม่ปะ 409" },
    { property: "og:title", content: "ห้องพัก — หอพักแม่ปะ 409" },
    { property: "og:description", content: "ดูและจัดการห้องพักและค่าเช่า" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: RoomsPage,
});

const statusStyle: Record<string, string> = {
  vacant: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  occupied: "bg-rose-50 text-rose-700 ring-rose-200",
  maintenance: "bg-amber-50 text-amber-700 ring-amber-200",
};

function RoomsPage() {
  const { data: rooms = [] } = useQuery(roomsQuery);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Room> | null>(null);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("all");
  const [roomType, setRoomType] = useState("all");

  const roomTypes = useMemo(() => [...new Set(rooms.map((r) => r.room_type).filter(Boolean))].sort(), [rooms]);
  const filtered = useMemo(() => rooms.filter((room) => {
    const matchesText = `${room.room_number} ${room.room_type} ${room.floor}`.toLowerCase().includes(keyword.trim().toLowerCase());
    const matchesStatus = status === "all" || room.status === status;
    const matchesType = roomType === "all" || room.room_type === roomType;
    return matchesText && matchesStatus && matchesType;
  }), [rooms, keyword, status, roomType]);

  const stats = [
    { label: "ห้องว่าง", value: rooms.filter((r) => r.status === "vacant").length, icon: DoorOpen, gradient: "from-emerald-500 to-teal-400" },
    { label: "มีผู้เช่าอยู่", value: rooms.filter((r) => r.status === "occupied").length, icon: Users, gradient: "from-rose-500 to-pink-400" },
    { label: "ปิดซ่อม", value: rooms.filter((r) => r.status === "maintenance").length, icon: Wrench, gradient: "from-amber-500 to-orange-400" },
    { label: "ห้องทั้งหมด", value: rooms.length, icon: BedDouble, gradient: "from-sky-500 to-blue-400" },
  ];

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const roomNumber = String(f.get("room_number") ?? "").trim();
    if (!roomNumber) { toast.error("กรุณาระบุเลขห้อง"); return; }
    let duplicateQuery = supabase.from("rooms").select("id").ilike("room_number", roomNumber);
    if (editing?.id) duplicateQuery = duplicateQuery.neq("id", editing.id);
    const { data: duplicates, error: duplicateError } = await duplicateQuery.limit(1);
    if (duplicateError) { toast.error(`ตรวจสอบเลขห้องไม่สำเร็จ: ${duplicateError.message}`); return; }
    if (duplicates?.length) { toast.error(`เลขห้อง ${roomNumber} มีอยู่ในระบบแล้ว`); return; }
    const row = {
      room_number: roomNumber,
      floor: Number(f.get("floor")),
      room_type: String(f.get("room_type")),
      monthly_rate: Number(f.get("monthly_rate")),
      daily_rate: Number(f.get("daily_rate")),
      status: String(f.get("status")),
    };
    const { error } = editing?.id
      ? await supabase.from("rooms").update(row).eq("id", editing.id)
      : await supabase.from("rooms").insert(row);
    if (error) {
      toast.error(error.code === "23505" ? `เลขห้อง ${roomNumber} มีอยู่ในระบบแล้ว` : error.message);
      return;
    }
    if (editing?.id) {
      await supabase.from("rentals").update({ rate: row.monthly_rate })
        .eq("room_id", editing.id).eq("status", "active").eq("rental_type", "monthly");
      qc.invalidateQueries({ queryKey: ["rentals"] });
    }
    toast.success("บันทึกแล้ว");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["rooms"] });
  }

  return (
    <>
      <PageHeader
        title="ห้องพัก"
        sub={`จัดการข้อมูลห้องพักทั้งหมด · ${rooms.length} ห้อง`}
        action={<Button onClick={() => setEditing({})} className="rounded-xl bg-[#1d3b64] shadow-sm hover:bg-[#102b50]"><Plus /> เพิ่มห้องพัก</Button>}
      />

      <section className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className={`relative min-h-[100px] overflow-hidden rounded-2xl bg-gradient-to-br ${stat.gradient} p-4 text-white shadow-md`}>
            <div className="absolute -right-3 -top-4 flex h-20 w-20 items-center justify-center rounded-full bg-white/15">
              <stat.icon className="h-8 w-8 text-white/85" />
            </div>
            <p className="relative text-xs font-semibold text-white/90">{stat.label}</p>
            <p className="relative mt-2 font-display text-3xl font-bold">{stat.value}</p>
          </div>
        ))}
      </section>

      <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1.6fr)_minmax(150px,0.8fr)_minmax(150px,0.8fr)_auto_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="ค้นหาหมายเลขห้อง..." className="h-10 rounded-xl pl-9" />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-xl border border-input bg-white px-3 text-sm text-slate-700">
            <option value="all">ทุกสถานะ</option>
            <option value="vacant">ห้องว่าง</option>
            <option value="occupied">มีผู้เช่า</option>
            <option value="maintenance">ปิดซ่อม</option>
          </select>
          <select value={roomType} onChange={(e) => setRoomType(e.target.value)} className="h-10 rounded-xl border border-input bg-white px-3 text-sm text-slate-700">
            <option value="all">ทุกประเภทห้อง</option>
            {roomTypes.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <Button variant="outline" className="h-10 rounded-xl border-[#1d3b64] text-[#1d3b64]" onClick={() => { setKeyword(""); setStatus("all"); setRoomType("all"); }}>
            <X className="h-4 w-4" /> ล้างตัวกรอง
          </Button>
          <div className="flex h-10 items-center justify-center rounded-xl bg-slate-50 px-4 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
            พบ {filtered.length} / {rooms.length} ห้อง
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:p-4">
        <div className="mb-3 flex items-center justify-between px-1">
          <div>
            <h3 className="font-display text-sm font-semibold text-[#173456]">รายการห้องพัก</h3>
            <p className="mt-0.5 text-xs text-slate-400">ข้อมูลห้องพักและอัตราค่าเช่า</p>
          </div>
          <span className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">ชั้นทั้งหมด</span>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="bg-gradient-to-r from-slate-50 to-indigo-50 text-slate-700">
              <tr>
                <th className="px-4 py-3 font-semibold">หมายเลขห้อง</th>
                <th className="px-4 py-3 font-semibold">ประเภท / ชั้น</th>
                <th className="px-4 py-3 text-right font-semibold">รายวัน</th>
                <th className="px-4 py-3 text-right font-semibold">รายเดือน</th>
                <th className="px-4 py-3 text-center font-semibold">สถานะ</th>
                <th className="px-4 py-3 text-right font-semibold">การดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">ไม่พบข้อมูลห้องพักตามเงื่อนไขที่เลือก</td></tr>
              ) : filtered.map((room) => (
                <tr key={room.id} className="border-t border-slate-100 transition hover:bg-blue-50/30">
                  <td className="px-4 py-4 font-display text-sm font-bold text-slate-800">{room.room_number}</td>
                  <td className="px-4 py-4"><p className="font-medium text-slate-700">{room.room_type}</p><p className="mt-0.5 text-[10px] text-slate-400">ชั้น {room.floor}</p></td>
                  <td className="px-4 py-4 text-right tabular-nums text-slate-700">{baht(room.daily_rate)}</td>
                  <td className="px-4 py-4 text-right tabular-nums text-slate-700">{baht(room.monthly_rate)}</td>
                  <td className="px-4 py-4 text-center">
                    <span className={`inline-flex rounded-full px-3 py-1.5 text-[11px] font-semibold ring-1 ring-inset ${statusStyle[room.status] ?? "bg-slate-100 text-slate-600 ring-slate-200"}`}>{roomStatusLabel[room.status] ?? room.status}</span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <Button size="sm" variant="outline" className="h-8 rounded-lg border-amber-300 px-3 text-amber-700 hover:bg-amber-50" onClick={() => setEditing(room)}>
                      <Pencil className="h-3.5 w-3.5" /> แก้ไข
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "แก้ไขห้องพัก" : "เพิ่มห้องพัก"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="grid grid-cols-2 gap-3">
            <Field label="เลขห้อง" name="room_number" defaultValue={editing?.room_number} required />
            <Field label="ชั้น" name="floor" type="number" defaultValue={editing?.floor ?? 1} />
            <Field label="ประเภท" name="room_type" defaultValue={editing?.room_type ?? "มาตรฐาน"} />
            <div className="space-y-1.5">
              <Label>สถานะ</Label>
              <select name="status" defaultValue={editing?.status ?? "vacant"} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                {Object.entries(roomStatusLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </div>
            <Field label="ค่าเช่ารายเดือน" name="monthly_rate" type="number" defaultValue={editing?.monthly_rate ?? 0} />
            <Field label="ค่าเช่ารายวัน" name="daily_rate" type="number" defaultValue={editing?.daily_rate ?? 0} />
            <Button type="submit" className="col-span-2 bg-[#1d3b64] hover:bg-[#102b50]">บันทึกข้อมูล</Button>
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
