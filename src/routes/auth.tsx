import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DORM_NAME, pickRole } from "@/lib/dorm";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: `เข้าสู่ระบบ — ${DORM_NAME}` },
      { name: "description", content: "เข้าสู่ระบบจัดการหอพัก" },
      { property: "og:title", content: `เข้าสู่ระบบ — ${DORM_NAME}` },
      { property: "og:description", content: "เข้าสู่ระบบจัดการหอพัก" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email"));
    const password = String(f.get("password"));
    setBusy(true);
    try {
      if (mode === "up") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: String(f.get("name")) } },
        });
        if (error) throw error;
        toast.success("สมัครสำเร็จ กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ");
        setMode("in");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
        const role = pickRole((roles ?? []).map((r) => r.role));
        navigate({ to: role === "tenant" ? "/my" : "/dashboard" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="bg-hero hidden flex-col justify-end p-12 text-primary-foreground md:flex">
        <h1 className="text-5xl font-bold">{DORM_NAME}</h1>
        <p className="mt-3 opacity-80">ระบบจัดการหอพัก</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
          <h2 className="text-3xl font-semibold">{mode === "in" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}</h2>
          {mode === "up" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">ชื่อ-นามสกุล</Label>
              <Input id="name" name="name" required />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">อีเมล</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">รหัสผ่าน</Label>
            <Input id="password" name="password" type="password" minLength={6} required />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "กำลังดำเนินการ..." : mode === "in" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
          </Button>
          <button
            type="button"
            className="w-full text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setMode(mode === "in" ? "up" : "in")}
          >
            {mode === "in" ? "ยังไม่มีบัญชี? สมัครสมาชิก" : "มีบัญชีแล้ว? เข้าสู่ระบบ"}
          </button>
        </form>
      </div>
    </div>
  );
}
