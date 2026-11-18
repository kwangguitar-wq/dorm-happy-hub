import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

function base64(bytes: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

async function verifyLineSignature(rawBody: string, signature: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = base64(digest);
  if (expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return mismatch === 0;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function replyLine(token: string, replyToken: string, text: string) {
  return fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
  });
}

export const Route = createFileRoute("/api/line/webhook")({
  server: {
    handlers: {
      GET: async () => Response.json({ ok: true, service: "Dorm Happy Hub LINE webhook" }),
      POST: async ({ request }) => {
        const secret = process.env.LINE_CHANNEL_SECRET;
        if (!secret) return new Response("LINE webhook is not configured", { status: 503 });
        const rawBody = await request.text();
        const signature = request.headers.get("x-line-signature") ?? "";
        if (!signature || !(await verifyLineSignature(rawBody, signature, secret))) return new Response("Invalid LINE signature", { status: 401 });

        let payload: { events?: Array<any> };
        try { payload = JSON.parse(rawBody); } catch { return new Response("Invalid JSON", { status: 400 }); }

        const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
        const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const admin = supabaseUrl && serviceKey
          ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
          : null;

        if (accessToken) {
          for (const event of payload.events ?? []) {
            if (event.type !== "message" || event.message?.type !== "text" || !event.replyToken) continue;
            const message = String(event.message.text ?? "").trim();
            if (/^ID$/i.test(message)) {
              const source = event.source ?? {};
              const lineId = source.groupId || source.userId || source.roomId || "ไม่พบ ID";
              await replyLine(accessToken, event.replyToken, `LINE ID สำหรับตั้งค่าการแจ้งเตือนผู้ดูแล:\n${lineId}\n\nสำหรับผู้เช่า ให้เชื่อมต่อจากหน้า “ห้องของฉัน” แล้วส่งรหัส LINK ที่ระบบแสดงให้ OA นี้`);
              continue;
            }

            const match = message.match(/^LINK\s+([A-HJ-NP-Z2-9]{8})$/i);
            if (!match) continue;
            if (event.source?.type !== "user" || !event.source?.userId) {
              await replyLine(accessToken, event.replyToken, "กรุณาส่งรหัสเชื่อมต่อในแชตส่วนตัวกับ LINE OA เท่านั้น");
              continue;
            }
            if (!admin) {
              await replyLine(accessToken, event.replyToken, "ระบบยังไม่พร้อมเชื่อมต่อ กรุณาติดต่อผู้ดูแลหอพัก");
              continue;
            }

            const codeHash = await sha256(match[1].toUpperCase());
            const { data: codeRow } = await admin.from("tenant_line_link_codes")
              .select("id, user_id, expires_at")
              .eq("code_hash", codeHash)
              .is("consumed_at", null)
              .gt("expires_at", new Date().toISOString())
              .maybeSingle();
            if (!codeRow) {
              await replyLine(accessToken, event.replyToken, "รหัสไม่ถูกต้องหรือหมดอายุแล้ว กรุณาสร้างรหัสใหม่จากหน้า “ห้องของฉัน”");
              continue;
            }

            const { data: consumed } = await admin.from("tenant_line_link_codes")
              .update({ consumed_at: new Date().toISOString() })
              .eq("id", codeRow.id)
              .is("consumed_at", null)
              .select("id")
              .maybeSingle();
            if (!consumed) {
              await replyLine(accessToken, event.replyToken, "รหัสนี้ถูกใช้งานแล้ว กรุณาสร้างรหัสใหม่");
              continue;
            }

            const { error: linkError } = await admin.from("tenant_line_links").upsert({
              user_id: codeRow.user_id,
              line_user_id: event.source.userId,
              linked_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }, { onConflict: "user_id" });
            if (linkError) {
              console.error("[LINE link]", linkError);
              await replyLine(accessToken, event.replyToken, "ไม่สามารถเชื่อมต่อ LINE นี้ได้ อาจมีการผูกกับบัญชีอื่นอยู่ กรุณาติดต่อผู้ดูแล");
              continue;
            }
            await replyLine(accessToken, event.replyToken, "เชื่อมต่อ LINE กับบัญชีผู้เช่าสำเร็จแล้ว คุณจะได้รับการแจ้งเตือนบิล การชำระเงิน และการแจ้งซ่อมจากหอพัก");
          }
        }
        return Response.json({ ok: true });
      },
    },
  },
});
