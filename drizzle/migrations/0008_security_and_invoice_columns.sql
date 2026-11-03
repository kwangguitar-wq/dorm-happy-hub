-- 1) Rooms: staff see all, others only rooms they rent
DROP POLICY IF EXISTS "rooms read" ON public.rooms;
CREATE POLICY "rooms read scoped" ON public.rooms FOR SELECT TO authenticated
USING (
  public.is_staff(auth.uid())
  OR EXISTS (SELECT 1 FROM public.rentals r WHERE r.room_id = rooms.id AND r.tenant_user_id = auth.uid())
);

-- 2) Settings: staff-only read (tenants see rates stored on each bill)
DROP POLICY IF EXISTS "settings read" ON public.settings;
CREATE POLICY "settings staff read" ON public.settings FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

-- 3) Invoice: bill number + due date
CREATE SEQUENCE IF NOT EXISTS public.bill_no_seq;
ALTER TABLE public.bills ADD COLUMN bill_no text;
ALTER TABLE public.bills ADD COLUMN due_date date;
CREATE UNIQUE INDEX IF NOT EXISTS bills_bill_no_key ON public.bills(bill_no) WHERE bill_no IS NOT NULL;
UPDATE public.bills SET bill_no = 'INV' || to_char(bill_month, 'YYYYMM') || '-' || lpad(nextval('public.bill_no_seq')::text, 4, '0') WHERE bill_no IS NULL;
UPDATE public.bills SET due_date = bill_month + 5 WHERE due_date IS NULL;

CREATE OR REPLACE FUNCTION public.assign_bill_no()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.bill_no IS NULL THEN
    NEW.bill_no := 'INV' || to_char(NEW.bill_month, 'YYYYMM') || '-' || lpad(nextval('public.bill_no_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER bills_assign_bill_no
BEFORE INSERT ON public.bills
FOR EACH ROW EXECUTE FUNCTION public.assign_bill_no();

-- 4) AI slip-reading cache on payments
ALTER TABLE public.payments ADD COLUMN ai_amount numeric;
ALTER TABLE public.payments ADD COLUMN ai_paid_on date;
ALTER TABLE public.payments ADD COLUMN ai_checked_at timestamptz;