import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { RepairsPanel } from "@/components/RepairsPanel";

export const Route = createFileRoute("/_authenticated/repairs")({
  head: () => ({ meta: [
    { title: "แจ้งซ่อม — หอพักแม่ปะ 409" },
    { name: "description", content: "ติดตามและจัดการรายการแจ้งซ่อมของหอพักแม่ปะ 409" },
    { property: "og:title", content: "แจ้งซ่อม — หอพักแม่ปะ 409" },
    { property: "og:description", content: "ติดตามและจัดการรายการแจ้งซ่อม" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => (
    <>
      <PageHeader title="รายการแจ้งซ่อม" sub="เปลี่ยนสถานะเมื่อเริ่มซ่อมหรือซ่อมเสร็จ" />
      <RepairsPanel staff />
    </>
  ),
});
