CREATE SEQUENCE IF NOT EXISTS public.receipt_no_seq;
CREATE OR REPLACE FUNCTION public.mark_bill_paid(_bill_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare r text; m date;
begin
  if not public.is_staff(auth.uid()) then raise exception 'ไม่มีสิทธิ์'; end if;
  select receipt_no, bill_month into r, m from public.bills where id = _bill_id for update;
  if r is null then
    r := 'RC' || to_char(m, 'YYYYMM') || '-' || lpad(nextval('public.receipt_no_seq')::text, 4, '0');
  end if;
  update public.bills set status = 'paid', paid_at = now(), receipt_no = r where id = _bill_id;
  return r;
end; $$;
REVOKE ALL ON FUNCTION public.mark_bill_paid(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mark_bill_paid(uuid) TO authenticated;