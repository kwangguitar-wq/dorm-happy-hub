import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { DORM_NAME } from "@/lib/dorm";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${DORM_NAME} — ระบบจัดการหอพัก` },
      { name: "description", content: "จัดการห้องพัก ผู้เช่า บิลค่าน้ำค่าไฟ และการชำระเงินของหอพักแม่ปะ 409" },
      { property: "og:title", content: `${DORM_NAME} — ระบบจัดการหอพัก` },
      { property: "og:description", content: "จัดการห้องพัก ผู้เช่า และบิลได้ทุกที่ทุกอุปกรณ์" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="bg-hero flex min-h-screen items-center px-6">
      <div className="mx-auto max-w-2xl text-primary-foreground">
        <p className="text-sm uppercase tracking-[0.3em] opacity-70">ระบบจัดการหอพัก</p>
        <h1 className="mt-3 text-5xl font-bold md:text-7xl">{DORM_NAME}</h1>
        <p className="mt-5 text-lg opacity-85">
          ดูแลห้องพัก ผู้เช่ารายวันและรายเดือน ได้จากมือถือ แท็บเล็ต หรือคอมพิวเตอร์
        </p>
        <Button asChild size="lg" variant="secondary" className="mt-8">
          <Link to="/auth">เข้าสู่ระบบ</Link>
        </Button>
      </div>
    </div>
  );
}
