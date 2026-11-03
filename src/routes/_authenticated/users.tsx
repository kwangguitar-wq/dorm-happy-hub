import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { meQuery, pickRole, rentalsQuery, roleLabel, type Role } from "@/lib/dorm";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({ meta: [{ title: "จัดการผู้ใช้ — แม่ปะ 409" }] }),
  component: Users,
});

const sel = "h-9 rounded-md border bg-background px-2 text-sm";

function Users() {
  const qc = useQueryClient();
  const { data: me } = useQuery(meQuery);
  const { data: rentals = [] } = useQuery(rentalsQuery());
  const active = rentals.filter((r) => r.status === "active");
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const [{ data: p, error }, { data: r }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (error) throw error;
      return (p ?? []).map((u) => ({ ...u, role: pickRole((r ?? []).filter((x) => x.user_id === u.id).map((x) => x.role)) }));
    },
  });
  const isOwner = me?.role === "owner";

  async function setRole(id: string, role: Role) {
    const { error } = await supabase.rpc("set_user_role", { _user_id: id, _role: role });
    if (error) { toast.error(error.message); return; }
    toast.success("เปลี่ยนบทบาทแล้ว");
    qc.invalidateQueries({ queryKey: ["users"] });
  }

  async function link(userId: string, rentalId: string) {
    const prev = active.find((r) => r.tenant_user_id === userId);
    if (prev && prev.id !== rentalId) {
      const { error } = await supabase.rpc("link_tenant", { _rental_id: prev.id, _user_id: null as unknown as string });
      if (error) { toast.error(error.message); return; }
    }
    if (rentalId) {
      const { error } = await supabase.rpc("link_tenant", { _rental_id: rentalId, _user_id: userId });
      if (error) { toast.error(error.message); return; }
    }
    toast.success(rentalId ? "ผูกบัญชีกับห้องแล้ว" : "ยกเลิกการผูกแล้ว");
    qc.invalidateQueries({ queryKey: ["rentals"] });
  }

  return (
    <>
      <PageHeader title="จัดการผู้ใช้" sub="กำหนดบทบาท และผูกบัญชีผู้เช่ากับห้องพัก" />
      <div className="space-y-3">
        {users.map((u) => {
          const linked = active.find((r) => r.tenant_user_id === u.id);
          return (
            <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
              <div className="min-w-0">
                <p className="truncate font-semibold">{u.full_name || "(ไม่มีชื่อ)"}</p>
                <p className="truncate text-sm text-muted-foreground">{u.email ?? "-"}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {isOwner && u.id !== me?.id ? (
                  <select aria-label="บทบาท" value={u.role} onChange={(e) => setRole(u.id, e.target.value as Role)} className={sel}>
                    {(Object.keys(roleLabel) as Role[]).map((k) => <option key={k} value={k}>{roleLabel[k]}</option>)}
                  </select>
                ) : <span className="text-sm">{roleLabel[u.role]}</span>}
                {u.role === "tenant" && (
                  <select aria-label="ห้อง" value={linked?.id ?? ""} onChange={(e) => link(u.id, e.target.value)} className={sel}>
                    <option value="">— ยังไม่ผูกห้อง —</option>
                    {active.map((r) => (
                      <option key={r.id} value={r.id} disabled={!!r.tenant_user_id && r.tenant_user_id !== u.id}>
                        ห้อง {r.rooms?.room_number} · {r.tenant_name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
