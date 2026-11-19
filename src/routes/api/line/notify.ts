import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

type NoticeType = "bill_created" | "payment_submitted" | "repair_created" | "payment_reviewed" | "repair_status_changed";
const response = (message: string, status = 200) => Response.json({ message }, { status });

export const Route = createFileRoute("/api/line/notify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return response("กรุณาเข้าสู่ระบบ", 401);
        const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
        const recipient = process.env.LINE_DORM_GROUP_ID || process.env.LINE_ADMIN_USER_ID;
        if (!supabaseUrl || !anonKey || !serviceKey) return response("ยังไม่ได้ตั้งค่า Supabase server credentials", 503);
        if (!lineToken || !recipient) return response("ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN และ LINE_ADMIN_USER_ID หรือ LINE_DORM_GROUP_ID", 503);

        let body: { type?: NoticeType; title?: string; detail?: string; tenantUserId?: string };
        try { body = await request.json(); } catch { return response("รูปแบบข้อมูลไม่ถูกต้อง", 400); }
        const allowed: NoticeType[] = ["bill_created", "payment_submitted", "repair_created", "payment_reviewed", "repair_status_changed"];
        if (!body.type || !allowed.includes(body.type)) return response("ไม่รองรับประเภทการแจ้งเตือน", 400);

        const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
        const { data: authData, error: authError } = await authClient.auth.getUser(token);
        if (authError || !authData.user) return response("เซสชันไม่ถูกต้อง", 401);

        const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
        const { data: roleRows, error: roleError } = await adminClient.from("user_roles").select("role").eq("user_id", authData.user.id);
        if (roleError) return response("ตรวจสอบสิทธิ์ไม่สำเร็จ", 500);
        const roles = (roleRows ?? []).map((row) => row.role);
        const isStaff = roles.includes("owner") || roles.includes("staff");
        if (["bill_created", "payment_reviewed", "repair_status_changed"].includes(body.type) && !isStaff) {
          return response("ไม่มีสิทธิ์ส่งการแจ้งเตือนรายการนี้", 403);
        }

        const { data: profile } = await adminClient.from("profiles").select("full_name").eq("id", authData.user.id).maybeSingle();
        const actorName = profile?.full_name?.trim() || authData.user.email || "ผู้ใช้ระบบ";
        const destinationByType: Record<NoticeType, string> = {
          bill_created: "/bills",
          payment_submitted: "/payments",
          repair_created: "/repairs",
          payment_reviewed: "/my",
          repair_status_changed: "/my",
        };
        const destinationUrl = new URL(destinationByType[body.type], request.url).toString();
        const title = String(body.title ?? "").slice(0, 120);
        const detail = String(body.detail ?? "").slice(0, 650);
        const text = [title || "แจ้งเตือนหอพักแม่ปะ 409", detail, `ผู้แจ้ง: ${actorName}`, `เปิดดูรายการ: ${destinationUrl}`].filter(Boolean).join("\n");

        const adminPush = await fetch("https://api.line.me/v2/bot/message/push", {
          method: "POST",
          headers: { Authorization: `Bearer ${lineToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ to: recipient, messages: [{ type: "text", text }] }),
        });
        if (!adminPush.ok) {
          console.error("[LINE notify admin]", adminPush.status, await adminPush.text());
          return response("ส่งแจ้งเตือนเข้ากลุ่มผู้ดูแลไม่สำเร็จ", 502);
        }

        if (body.tenantUserId && ["bill_created", "payment_reviewed", "repair_status_changed"].includes(body.type)) {
          const { data: link, error: linkError } = await adminClient.from("tenant_line_links")
            .select("line_user_id").eq("user_id", body.tenantUserId).maybeSingle();
          if (linkError) {
            console.error("[LINE tenant lookup]", linkError);
            return response("ส่งแจ้งเตือนกลุ่มแล้ว แต่ค้นหาบัญชี LINE ผู้เช่าไม่สำเร็จ", 502);
          }
          if (link?.line_user_id) {
            const tenantUrl = new URL("/my", request.url).toString();
            const tenantText = [title || "แจ้งเตือนจากหอพักแม่ปะ 409", detail, `เปิดดูข้อมูลของฉัน: ${tenantUrl}`].filter(Boolean).join("\n");
            const tenantPush = await fetch("https://api.line.me/v2/bot/message/push", {
              method: "POST",
              headers: { Authorization: `Bearer ${lineToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({ to: link.line_user_id, messages: [{ type: "text", text: tenantText }] }),
            });
            if (!tenantPush.ok) {
              console.error("[LINE notify tenant]", tenantPush.status, await tenantPush.text());
              return response("ส่งแจ้งเตือนกลุ่มแล้ว แต่ส่งข้อความถึงผู้เช่าไม่สำเร็จ", 502);
            }
          }
        }
        return response("ส่งการแจ้งเตือน LINE แล้ว");
      },
    },
  },
});
