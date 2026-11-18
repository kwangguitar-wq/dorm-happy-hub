import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { meQuery, pickRole, rentalsQuery, roleLabel, type Role } from "@/lib/dorm";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({ meta: [
    { title: "จัดการผู้ใช้ — หอพักแม่ปะ 409" },
    { name: "description", content: "จัดการบัญชีและการผูกผู้เช่ากับห้องพัก หอพักแม่ปะ 409" },
    { property: "og:title", content: "จัดการผู้ใช้ — หอพักแม่ปะ 409" },
    { property: "og:description", content: "จัดการบัญชีและการผูกผู้เช่ากับห้องพัก" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Users,
});

const sel = "h-9 rounded-md border bg-background px-2 text-sm";

function Users() {
  const qc = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);
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

  async function deleteTenant(userId: string, email: string | null) {
    const confirmed = window.confirm(
      `ยืนยันลบบัญชีเข้าสู่ระบบของ ${email || "ผู้เช่ารายนี้"}?\n\nระบบจะเก็บประวัติการเช่า บิล การชำระเงิน และหลักฐานไว้ และอนุญาตให้สมัครใหม่ด้วยอีเมลเดิมได้`,
    );
    if (!confirmed) return;

    setDeletingId(userId);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.access_token) {
        throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
      }
      const response = await fetch("/api/admin/delete-tenant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({ userId }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message || "ลบบัญชีไม่สำเร็จ");

      toast.success(result.message || "ลบบัญชีแล้ว");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["users"] }),
        qc.invalidateQueries({ queryKey: ["rentals"] }),
        qc.invalidateQueries({ queryKey: ["bills"] }),
        qc.invalidateQueries({ queryKey: ["payments"] }),
        qc.invalidateQueries({ queryKey: ["repairs"] }),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการลบบัญชี");
    } finally {
      setDeletingId(null);
    }
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
                {isOwner && u.role === "tenant" && (
                  <button
                    type="button"
                    className="h-9 rounded-md border border-destructive/40 px-3 text-sm text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={deletingId !== null}
                    onClick={() => deleteTenant(u.id, u.email)}
                  >
                    {deletingId === u.id ? "กำลังลบ..." : "ลบบัญชี"}
                  </button>
                )}
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
