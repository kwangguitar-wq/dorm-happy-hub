ALTER TABLE public.bills ADD COLUMN other_fee numeric NOT NULL DEFAULT 0;
ALTER TABLE public.bills ADD COLUMN other_note text;
COMMENT ON COLUMN public.bills.other_fee IS 'ค่าอื่นๆ เช่น ค่าส่วนกลาง ค่าปรับ';