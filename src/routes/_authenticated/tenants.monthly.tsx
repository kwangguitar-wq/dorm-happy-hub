import { createFileRoute } from "@tanstack/react-router";
import { RentalsManager } from "@/components/RentalsManager";

export const Route = createFileRoute("/_authenticated/tenants/monthly")({
  head: () => ({ meta: [
    { title: "ผู้เช่ารายเดือน — หอพักแม่ปะ 409" },
    { name: "description", content: "จัดการสัญญาและผู้เช่ารายเดือนของหอพักแม่ปะ 409" },
    { property: "og:title", content: "ผู้เช่ารายเดือน — หอพักแม่ปะ 409" },
    { property: "og:description", content: "จัดการสัญญาและผู้เช่ารายเดือน" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <RentalsManager type="monthly" />,
});
