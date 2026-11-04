// Client-safe helpers to print a pre-payment invoice (ใบแจ้งหนี้) from a bill row.
import { baht, DORM_NAME } from "./dorm";
import { units } from "./billing";

type InvoiceBill = {
  bill_no: string | null;
  bill_month: string;
  due_date: string | null;
  rooms?: { room_number: unknown } | null;
  rent: number;
  water_prev: number;
  water_curr: number;
  electric_prev: number;
  electric_curr: number;
  water_rate: number;
  electric_rate: number;
  other_fee: number | null;
  other_note: string | null;
  total: number;
};

/** Opens a printable invoice window (Save as PDF via the browser print dialog). */
export function printInvoice(b: InvoiceBill) {
  const wUnits = units(b.water_prev, b.water_curr);
  const eUnits = units(b.electric_prev, b.electric_curr);
  const row = (label: string, val: string) =>
    `<tr><td style="padding:6px 0">${label}</td><td style="text-align:right;padding:6px 0">${val}</td></tr>`;
  const th = (d: string | null, opts: Intl.DateTimeFormatOptions) =>
    d ? new Date(d).toLocaleDateString("th-TH", opts) : "-";
  const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>ใบแจ้งหนี้ ${b.bill_no ?? "-"}</title>
<style>body{font-family:'Sarabun',Tahoma,sans-serif;max-width:640px;margin:24px auto;color:#111;padding:0 16px}
table{width:100%;border-collapse:collapse} .line td{border-top:1px solid #ddd}
h1{font-size:22px;margin:0} .muted{color:#666;font-size:13px}
.total td{font-size:18px;font-weight:700;border-top:2px solid #111}
.warn{border:1px solid #c0392b;color:#c0392b;padding:10px 12px;border-radius:8px;margin-top:16px;font-size:14px}</style></head><body>
<h1>ใบแจ้งหนี้ / ค่าใช้จ่าย</h1>
<div class="muted">${DORM_NAME}</div>
<p class="muted">เลขที่บิล ${b.bill_no ?? "-"} · ห้อง ${b.rooms?.room_number ?? "-"}<br>
ประจำเดือน ${th(b.bill_month, { month: "long", year: "numeric" })} · ครบกำหนดชำระ ${th(b.due_date, { dateStyle: "long" })}</p>
<table>
${row("ค่าเช่าห้อง", baht(b.rent))}
${row(`ค่าน้ำ ${wUnits} หน่วย × ${baht(b.water_rate)}`, baht(wUnits * b.water_rate))}
${row(`ค่าไฟ ${eUnits} หน่วย × ${baht(b.electric_rate)}`, baht(eUnits * b.electric_rate))}
${Number(b.other_fee) > 0 ? row(`ค่าอื่นๆ${b.other_note ? ` (${b.other_note})` : ""}`, baht(b.other_fee)) : ""}
<tr class="total line"><td style="padding:10px 0">ยอดที่ต้องชำระ</td><td style="text-align:right;padding:10px 0">${baht(b.total)}</td></tr>
</table>
<p class="warn">กรุณาชำระภายในวันครบกำหนดด้านบน และแจ้งชำระพร้อมแนบสลิปในระบบ หลังชำระเงิน</p>
<script>window.print()</script></body></html>`;
  const win = window.open("", "_blank", "width=720,height=800");
  if (win) { win.document.write(html); win.document.close(); }
}
