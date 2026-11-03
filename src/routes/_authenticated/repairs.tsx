import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { RepairsPanel } from "@/components/RepairsPanel";

export const Route = createFileRoute("/_authenticated/repairs")({
  head: () => ({ meta: [{ title: "แจ้งซ่อม — แม่ปะ 409" }] }),
  component: () => (
    <>
      <PageHeader title="รายการแจ้งซ่อม" sub="เปลี่ยนสถานะเมื่อเริ่มซ่อมหรือซ่อมเสร็จ" />
      <RepairsPanel staff />
    </>
  ),
});
