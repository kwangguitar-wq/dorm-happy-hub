import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Room = Tables<"rooms">;
export type Rental = Tables<"rentals">;
export type Role = "owner" | "staff" | "tenant";

export const DORM_NAME = "แม่ปะ 409";

export const baht = (n: number | string | null | undefined) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(
    Number(n ?? 0),
  );

export const thDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" }) : "-";

export const roomStatusLabel: Record<string, string> = {
  vacant: "ว่าง",
  occupied: "มีผู้เช่า",
  maintenance: "ปิดซ่อม",
};

export const roleLabel: Record<Role, string> = { owner: "เจ้าของ", staff: "พนักงาน", tenant: "ผู้เช่า" };

/** Highest role wins: owner > staff > tenant. */
export function pickRole(roles: string[]): Role {
  if (roles.includes("owner")) return "owner";
  if (roles.includes("staff")) return "staff";
  return "tenant";
}

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const [{ data: roles }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", u.user.id),
      supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle(),
    ]);
    return {
      id: u.user.id,
      email: u.user.email ?? "",
      name: profile?.full_name || u.user.email || "",
      role: pickRole((roles ?? []).map((r) => r.role)),
    };
  },
});

export const roomsQuery = queryOptions({
  queryKey: ["rooms"],
  queryFn: async () => {
    const { data, error } = await supabase.from("rooms").select("*").order("room_number");
    if (error) throw error;
    return data;
  },
});

export const rentalsQuery = (type?: "daily" | "monthly") =>
  queryOptions({
    queryKey: ["rentals", type ?? "all"],
    queryFn: async () => {
      let q = supabase.from("rentals").select("*, rooms(room_number)").order("check_in", { ascending: false });
      if (type) q = q.eq("rental_type", type);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

/** Nights between check-in and check-out (min 1). */
export function nightsBetween(checkIn: string, checkOut: string | null) {
  if (!checkOut) return 1;
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.max(1, Math.round(ms / 86400000));
}
