import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const json = (message: string, status = 200) =>
  Response.json({ message }, { status });

export const Route = createFileRoute("/api/admin/delete-tenant")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return json("กรุณาเข้าสู่ระบบใหม่", 401);

        const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const anonKey =
          process.env.SUPABASE_PUBLISHABLE_KEY ||
          process.env.SUPABASE_ANON_KEY ||
          process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !anonKey || !serviceKey) {
          return json("ระบบยังไม่ได้ตั้งค่า Supabase สำหรับงานผู้ดูแล", 503);
        }

        let body: { userId?: string };
        try {
          body = await request.json();
        } catch {
          return json("ข้อมูลคำขอไม่ถูกต้อง", 400);
        }
        if (!body.userId || typeof body.userId !== "string") {
          return json("ไม่พบรหัสบัญชีที่ต้องการลบ", 400);
        }

        const authClient = createClient(url, anonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: actorData, error: actorError } = await authClient.auth.getUser(token);
        if (actorError || !actorData.user) return json("เซสชันไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่", 401);

        const admin = createClient(url, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: actorRoles, error: actorRoleError } = await admin
          .from("user_roles").select("role").eq("user_id", actorData.user.id);
        if (actorRoleError) return json("ตรวจสอบสิทธิ์ผู้ดูแลไม่สำเร็จ", 500);
        if (!(actorRoles ?? []).some((r) => r.role === "owner")) {
          return json("เฉพาะเจ้าของระบบเท่านั้นที่ลบบัญชีผู้เช่าได้", 403);
        }
        if (body.userId === actorData.user.id) return json("ไม่สามารถลบบัญชีที่กำลังใช้งานอยู่ได้", 400);

        const { data: target, error: targetError } = await admin.auth.admin.getUserById(body.userId);
        if (targetError || !target.user) return json("ไม่พบบัญชีผู้ใช้", 404);
        const { data: targetRoles, error: targetRoleError } = await admin
          .from("user_roles").select("role").eq("user_id", body.userId);
        if (targetRoleError) return json("อ่านบทบาทบัญชีเป้าหมายไม่สำเร็จ", 500);
        if (!(targetRoles ?? []).length || (targetRoles ?? []).some((r) => r.role !== "tenant")) {
          return json("เพื่อความปลอดภัย ฟังก์ชันนี้ลบได้เฉพาะบัญชีผู้เช่าเท่านั้น", 403);
        }

        const email = target.user.email?.trim().toLowerCase();
        if (!email) return json("บัญชีนี้ไม่มีอีเมล จึงไม่สามารถเก็บตัวเชื่อมประวัติได้", 400);

        const { data: profile } = await admin
          .from("profiles").select("full_name, phone").eq("id", body.userId).maybeSingle();
        const { data: rentals } = await admin
          .from("rentals").select("tenant_name, phone").eq("tenant_user_id", body.userId).limit(1);
        const fullName = profile?.full_name || rentals?.[0]?.tenant_name || "";
        const phone = profile?.phone || rentals?.[0]?.phone || null;

        const { data: customer, error: customerError } = await admin
          .from("tenant_customers")
          .upsert(
            { normalized_email: email, full_name: fullName, phone, auth_user_id: body.userId },
            { onConflict: "normalized_email" },
          )
          .select("id")
          .single();
        if (customerError || !customer) {
          console.error("[delete tenant] customer archive", customerError);
          return json("ยังไม่ได้ติดตั้งฐานข้อมูลส่วนเก็บประวัติลูกค้า กรุณาใช้ migration 202611180002 ก่อน", 503);
        }

        const customerId = customer.id;
        const tables = ["rentals", "bills", "payments", "repairs"] as const;
        for (const table of tables) {
          const { error } = await admin.from(table).update({
            customer_id: customerId,
            tenant_user_id: null,
          }).eq("tenant_user_id", body.userId);
          if (error) {
            console.error("[delete tenant] detach history", table, error);
            for (const rollbackTable of tables) {
              await admin.from(rollbackTable).update({ tenant_user_id: body.userId }).eq("customer_id", customerId);
            }
            await admin.from("tenant_customers").update({ auth_user_id: null }).eq("id", customerId);
            return json("เก็บประวัติลูกค้าไม่สำเร็จ จึงยกเลิกการลบบัญชี", 500);
          }
        }

        const { error: deleteError } = await admin.auth.admin.deleteUser(body.userId);
        if (deleteError) {
          console.error("[delete tenant] Auth deletion", deleteError);
          for (const table of tables) {
            await admin.from(table).update({ tenant_user_id: body.userId }).eq("customer_id", customerId);
          }
          await admin.from("tenant_customers").update({ auth_user_id: body.userId }).eq("id", customerId);
          return json(
            "ไม่สามารถลบบัญชี Auth ได้ อาจมีไฟล์ Storage ที่บัญชีเป็นเจ้าของ กรุณาตรวจสอบ Storage ก่อนลองอีกครั้ง",
            409,
          );
        }

        return json("ลบบัญชีเข้าสู่ระบบแล้ว และเก็บประวัติลูกค้าไว้สำหรับสมัครใหม่ด้วยอีเมลเดิม");
      },
    },
  },
});
