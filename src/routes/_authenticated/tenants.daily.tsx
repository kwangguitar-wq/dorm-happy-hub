import { createFileRoute } from "@tanstack/react-router";
import { RentalsManager } from "@/components/RentalsManager";

export const Route = createFileRoute("/_authenticated/tenants/daily")({
  head: () => ({ meta: [
    { title: "ผู้เช่ารายวัน — หอพักแม่ปะ 409" },
    { name: "description", content: "จัดการการเข้าพักรายวันของหอพักแม่ปะ 409" },
    { property: "og:title", content: "ผู้เช่ารายวัน — หอพักแม่ปะ 409" },
    { property: "og:description", content: "จัดการการเข้าพักรายวัน" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <RentalsManager type="daily" />,
});
