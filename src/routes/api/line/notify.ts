import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

type NoticeType = "bill_created" | "payment_submitted" | "repair_created";

const response = (message: string, status = 200) =>
  Response.json({ message }, { status });

export const Route = createFileRoute("/api/line/notify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return response("กรุณาเข้าสู่ระบบ", 401);

        const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const anonKey =
          process.env.SUPABASE_PUBLISHABLE_KEY ||
          process.env.SUPABASE_ANON_KEY ||
          process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
        const recipient = process.env.LINE_DORM_GROUP_ID || process.env.LINE_ADMIN_USER_ID;

        if (!supabaseUrl || !anonKey || !serviceKey) {
          return response("ยังไม่ได้ตั้งค่า Supabase server credentials", 503);
        }
        if (!lineToken || !recipient) {
          return response("ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN และ LINE_ADMIN_USER_ID หรือ LINE_DORM_GROUP_ID", 503);
        }

        let body: { type?: NoticeType; title?: string; detail?: string };
        try {
          body = await request.json();
        } catch {
          return response("รูปแบบข้อมูลไม่ถูกต้อง", 400);
        }
        const allowed: NoticeType[] = ["bill_created", "payment_submitted", "repair_created"];
        if (!body.type || !allowed.includes(body.type)) return response("ไม่รองรับประเภทการแจ้งเตือน", 400);

        const authClient = createClient(supabaseUrl, anonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: authData, error: authError } = await authClient.auth.getUser(token);
        if (authError || !authData.user) return response("เซสชันไม่ถูกต้อง", 401);

        const adminClient = createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: roleRows, error: roleError } = await adminClient
          .from("user_roles")
          .select("role")
          .eq("user_id", authData.user.id);
        if (roleError) return response("ตรวจสอบสิทธิ์ไม่สำเร็จ", 500);

        const roles = (roleRows ?? []).map((row) => row.role);
        const isStaff = roles.includes("owner") || roles.includes("staff");
        if (body.type === "bill_created" && !isStaff) return response("ไม่มีสิทธิ์แจ้งเตือนการสร้างบิล", 403);

        const title = String(body.title ?? "").slice(0, 120);
        const detail = String(body.detail ?? "").slice(0, 700);
        const text = [title || "แจ้งเตือนหอพักแม่ปะ 409", detail, `ผู้ดำเนินการ: ${authData.user.email ?? "ผู้ใช้ระบบ"}`]
          .filter(Boolean)
          .join("\n");

        const lineResponse = await fetch("https://api.line.me/v2/bot/message/push", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lineToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: recipient,
            messages: [{ type: "text", text }],
          }),
        });
        if (!lineResponse.ok) {
          const errorText = await lineResponse.text();
          console.error("[LINE notify]", lineResponse.status, errorText);
          return response("LINE ส่งข้อความไม่สำเร็จ กรุณาตรวจสอบ Channel token และผู้รับ", 502);
        }
        return response("ส่งการแจ้งเตือน LINE แล้ว");
      },
    },
  },
});
