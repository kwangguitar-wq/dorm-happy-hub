import { createFileRoute } from "@tanstack/react-router";
import { RentalsManager } from "@/components/RentalsManager";

export const Route = createFileRoute("/_authenticated/tenants/daily")({
  head: () => ({ meta: [{ title: "ผู้เช่ารายวัน — แม่ปะ 409" }] }),
  component: () => <RentalsManager type="daily" />,
});
