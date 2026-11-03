import { createFileRoute } from "@tanstack/react-router";
import { RentalsManager } from "@/components/RentalsManager";

export const Route = createFileRoute("/_authenticated/tenants/monthly")({
  head: () => ({ meta: [{ title: "ผู้เช่ารายเดือน — แม่ปะ 409" }] }),
  component: () => <RentalsManager type="monthly" />,
});
