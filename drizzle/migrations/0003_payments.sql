CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  tenant_user_id uuid NOT NULL DEFAULT auth.uid(),
  amount numeric NOT NULL DEFAULT 0,
  paid_on date NOT NULL DEFAULT CURRENT_DATE,
  slip_path text,
  note text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments staff all" ON public.payments FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "payments tenant read own" ON public.payments FOR SELECT TO authenticated
  USING (tenant_user_id = auth.uid());
CREATE POLICY "payments tenant insert own" ON public.payments FOR INSERT TO authenticated
  WITH CHECK (tenant_user_id = auth.uid() AND status = 'pending'
    AND EXISTS (SELECT 1 FROM public.bills b WHERE b.id = bill_id AND b.tenant_user_id = auth.uid()));
CREATE POLICY "slips tenant upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'slips' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "slips read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'slips' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_staff(auth.uid())));