ALTER TABLE public.bills ADD COLUMN receipt_no text;
ALTER TABLE public.bills ADD COLUMN paid_at timestamptz;
COMMENT ON COLUMN public.bills.receipt_no IS 'เลขที่ใบเสร็จ ออกเมื่อชำระเงิน';
CREATE UNIQUE INDEX bills_receipt_no_key ON public.bills (receipt_no) WHERE receipt_no IS NOT NULL;
CREATE SEQUENCE public.receipt_no_seq START 1;
