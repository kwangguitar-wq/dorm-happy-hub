// Client-safe server functions for AI slip reading in the payments review page.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { readSlipWithAI } from "./ai-gateway.server";

export type SlipReadResult =
  | { ok: true; paymentId: string; ai_amount: number | null; ai_paid_on: string | null; ai_bank: string | null }
  | { ok: false; paymentId: string; error: string };

export const readSlipWithAIFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { paymentId: string }) => input)
  .handler(async ({ data, context }) => {
    const fail = (error: string): SlipReadResult => ({ ok: false, paymentId: data.paymentId, error });
    try {
      // Only owner or staff may read slips.
      const [{ data: isOwner }, { data: isStaff }] = await Promise.all([
        context.supabase.rpc("has_role", { _user_id: context.userId, _role: "owner" }),
        context.supabase.rpc("has_role", { _user_id: context.userId, _role: "staff" }),
      ]);
      if (!isOwner && !isStaff) return fail("ไม่มีสิทธิ์ใช้งานฟีเจอร์นี้");

      const { data: payment } = await context.supabase
        .from("payments")
        .select("id, slip_path")
        .eq("id", data.paymentId)
        .maybeSingle();
      if (!payment) return fail("ไม่พบรายการแจ้งชำระ");
      if (!payment.slip_path) return fail("รายการนี้ไม่มีสลิปแนบ");

      // The slips bucket is private: download with the service role after the role check above.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: blob, error: dlError } = await supabaseAdmin.storage.from("slips").download(payment.slip_path);
      if (dlError || !blob) return fail("ดาวน์โหลดสลิปไม่สำเร็จ");

      const buf = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      for (let i = 0; i < buf.length; i += 0x8000) {
        binary += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      }
      const mime = blob.type || "image/jpeg";
      const dataUrl = `data:${mime};base64,${btoa(binary)}`;

      const read = await readSlipWithAI(dataUrl);
      if (!read.ok) return fail(read.error);

      const now = new Date().toISOString();
      const { error: upError } = await context.supabase
        .from("payments")
        .update({
          ai_amount: read.data.amount,
          ai_paid_on: read.data.paid_on,
          ai_checked_at: now,
        })
        .eq("id", payment.id);
      if (upError) console.error("[slip-reader] cache update failed", upError.message);

      return {
        ok: true as const,
        paymentId: payment.id,
        ai_amount: read.data.amount,
        ai_paid_on: read.data.paid_on,
        ai_bank: read.data.bank,
      };
    } catch (error) {
      console.error("[slip-reader] unexpected failure", error);
      return fail("เกิดข้อผิดพลาด กรุณาลองอีกครั้ง");
    }
  });
