import { createFileRoute } from "@tanstack/react-router";

function base64(bytes: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

async function verifyLineSignature(rawBody: string, signature: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = base64(digest);
  if (expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return mismatch === 0;
}

export const Route = createFileRoute("/api/line/webhook")({
  server: {
    handlers: {
      GET: async () => Response.json({ ok: true, service: "Dorm Happy Hub LINE webhook" }),
      POST: async ({ request }) => {
        const secret = process.env.LINE_CHANNEL_SECRET;
        if (!secret) return new Response("LINE webhook is not configured", { status: 503 });

        // LINE requires signature verification against the exact, unmodified request body.
        const rawBody = await request.text();
        const signature = request.headers.get("x-line-signature") ?? "";
        if (!signature || !(await verifyLineSignature(rawBody, signature, secret))) {
          return new Response("Invalid LINE signature", { status: 401 });
        }

        let payload: { events?: Array<any> };
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
        if (accessToken) {
          for (const event of payload.events ?? []) {
            if (event.type !== "message" || event.message?.type !== "text" || event.message.text.trim().toUpperCase() !== "ID" || !event.replyToken) {
              continue;
            }
            const source = event.source ?? {};
            const lineId = source.groupId || source.userId || source.roomId || "ไม่พบ ID";
            await fetch("https://api.line.me/v2/bot/message/reply", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: [{ type: "text", text: `LINE ID สำหรับตั้งค่าการแจ้งเตือน:\n${lineId}\n\nนำ ID นี้ไปใส่ใน Vercel Environment Variables ที่ LINE_ADMIN_USER_ID (แชตส่วนตัว) หรือ LINE_DORM_GROUP_ID (กลุ่ม)` }],
              }),
            });
          }
        }
        return Response.json({ ok: true });
      },
    },
  },
});
