import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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

type AuthMode = "in" | "up" | "forgot" | "reset";

function AuthPage() {
  const [mode, setMode] = useState<AuthMode>("in");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  // Supabase returns the browser to /auth?mode=recovery after the user opens
  // the one-time recovery link from their email.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "recovery") setMode("reset");
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") ?? "").trim();
    const password = String(f.get("password") ?? "");
    setBusy(true);

    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth?mode=recovery`,
        });
        if (error) throw error;
        // Keep the confirmation generic so the page does not reveal whether
        // an email address is registered in the Auth project.
        toast.success("ส่งคำขอรีเซ็ตรหัสผ่านแล้ว กรุณาตรวจสอบกล่องอีเมลและจดหมายขยะ");
        setMode("in");
        return;
      }

      if (mode === "reset") {
        const confirmPassword = String(f.get("confirmPassword") ?? "");
        if (password.length < 6) throw new Error("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
        if (password !== confirmPassword) throw new Error("รหัสผ่านทั้งสองช่องไม่ตรงกัน");

        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        toast.success("เปลี่ยนรหัสผ่านเรียบร้อยแล้ว กรุณาเข้าสู่ระบบอีกครั้ง");
        await supabase.auth.signOut();
        window.history.replaceState({}, document.title, window.location.pathname);
        setMode("in");
        return;
      }

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
      toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  }

  const heading =
    mode === "in" ? "เข้าสู่ระบบ" :
    mode === "up" ? "สมัครสมาชิก" :
    mode === "forgot" ? "ลืมรหัสผ่าน" :
    "ตั้งรหัสผ่านใหม่";

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="bg-hero hidden flex-col justify-end p-12 text-primary-foreground md:flex">
        <h1 className="text-5xl font-bold">{DORM_NAME}</h1>
        <p className="mt-3 opacity-80">ระบบจัดการหอพัก</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
          <h2 className="text-3xl font-semibold">{heading}</h2>

          {mode === "forgot" && (
            <p className="text-sm text-muted-foreground">
              กรอกอีเมลที่ใช้เข้าสู่ระบบ เราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้
            </p>
          )}

          {mode === "reset" && (
            <p className="text-sm text-muted-foreground">
              ตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ โดยเปิดหน้านี้จากลิงก์รีเซ็ตที่ส่งไปทางอีเมล
            </p>
          )}

          {mode === "up" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">ชื่อ-นามสกุล</Label>
              <Input id="name" name="name" required />
            </div>
          )}

          {mode !== "reset" && (
            <div className="space-y-1.5">
              <Label htmlFor="email">อีเมล</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue="kwangguitar@gmail.com"
                required
                autoComplete="email"
              />
            </div>
          )}

          {mode !== "forgot" && (
            <div className="space-y-1.5">
              <Label htmlFor="password">{mode === "reset" ? "รหัสผ่านใหม่" : "รหัสผ่าน"}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                minLength={6}
                required
                autoComplete={mode === "reset" || mode === "up" ? "new-password" : "current-password"}
              />
            </div>
          )}

          {mode === "reset" && (
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">ยืนยันรหัสผ่านใหม่</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                minLength={6}
                required
                autoComplete="new-password"
              />
            </div>
          )}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "กำลังดำเนินการ..." :
              mode === "in" ? "เข้าสู่ระบบ" :
              mode === "up" ? "สมัครสมาชิก" :
              mode === "forgot" ? "ส่งลิงก์รีเซ็ตรหัสผ่าน" :
              "บันทึกรหัสผ่านใหม่"}
          </Button>

          {mode === "in" && (
            <>
              <button
                type="button"
                className="w-full text-sm text-primary hover:underline"
                onClick={() => setMode("forgot")}
              >
                ลืมรหัสผ่าน?
              </button>
              <button
                type="button"
                className="w-full text-sm text-muted-foreground hover:text-foreground"
                onClick={() => setMode("up")}
              >
                ยังไม่มีบัญชี? สมัครสมาชิก
              </button>
            </>
          )}

          {mode === "up" && (
            <button
              type="button"
              className="w-full text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setMode("in")}
            >
              มีบัญชีแล้ว? เข้าสู่ระบบ
            </button>
          )}

          {mode === "forgot" && (
            <button
              type="button"
              className="w-full text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setMode("in")}
            >
              กลับไปเข้าสู่ระบบ
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
