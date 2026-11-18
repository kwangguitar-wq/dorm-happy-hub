import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const json = (message: string, status = 200, extra: Record<string, unknown> = {}) =>
  Response.json({ message, ...extra }, { status });

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const Route = createFileRoute("/api/line/link-code")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return json("กรุณาเข้าสู่ระบบ", 401);
        const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !anonKey || !serviceKey) return json("ระบบยังไม่ได้ตั้งค่า Supabase server credentials", 503);

        const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
        const { data, error } = await auth.auth.getUser(token);
        if (error || !data.user) return json("เซสชันไม่ถูกต้อง", 401);

        const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
        const { data: roles, error: roleError } = await admin.from("user_roles").select("role").eq("user_id", data.user.id);
        if (roleError) return json("ตรวจสอบสิทธิ์ไม่สำเร็จ", 500);
        if (!(roles ?? []).some((r) => r.role === "tenant")) return json("ฟังก์ชันนี้สำหรับบัญชีผู้เช่าเท่านั้น", 403);

        const { data: linked } = await admin.from("tenant_line_links").select("line_user_id").eq("user_id", data.user.id).maybeSingle();
        if (linked) return json("บัญชีนี้เชื่อมต่อ LINE อยู่แล้ว", 200, { linked: true });

        const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        const bytes = crypto.getRandomValues(new Uint8Array(8));
        const code = [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
        const codeHash = await sha256(code);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        await admin.from("tenant_line_link_codes").delete().eq("user_id", data.user.id);
        const { error: insertError } = await admin.from("tenant_line_link_codes").insert({
          user_id: data.user.id, code_hash: codeHash, expires_at: expiresAt,
        });
        if (insertError) {
          console.error("[LINE link code]", insertError);
          return json("สร้างรหัสเชื่อมต่อไม่สำเร็จ กรุณาลองใหม่", 500);
        }
        return json("สร้างรหัสเชื่อมต่อแล้ว", 200, { code, expiresAt });
      },
    },
  },
});
