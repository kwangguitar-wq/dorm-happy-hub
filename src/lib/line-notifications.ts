import { supabase } from "@/integrations/supabase/client";

export type LineNoticeType = "bill_created" | "payment_submitted" | "repair_created";

/**
 * Sends an authenticated request to the server-side LINE notifier.
 * LINE credentials never leave the server. Notification failure must not undo
 * the already-saved dorm transaction.
 */
export async function notifyLine(type: LineNoticeType, title: string, detail: string) {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) return { ok: false, message: "ไม่พบเซสชันผู้ใช้" };

  try {
    const response = await fetch("/api/line/notify", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type, title, detail }),
    });
    const result = (await response.json().catch(() => ({}))) as { message?: string };
    return { ok: response.ok, message: result.message ?? "ไม่สามารถส่งการแจ้งเตือน LINE ได้" };
  } catch {
    return { ok: false, message: "เชื่อมต่อบริการแจ้งเตือน LINE ไม่สำเร็จ" };
  }
}
