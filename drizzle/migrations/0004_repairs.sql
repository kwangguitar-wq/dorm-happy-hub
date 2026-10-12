CREATE TABLE public.repairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  tenant_user_id uuid DEFAULT auth.uid(),
  title text NOT NULL,
  detail text,
  status text NOT NULL DEFAULT 'pending',
  staff_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.repairs TO authenticated;
GRANT ALL ON public.repairs TO service_role;
ALTER TABLE public.repairs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "repairs staff all" ON public.repairs FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "repairs tenant read own" ON public.repairs FOR SELECT TO authenticated
  USING (tenant_user_id = auth.uid());
CREATE POLICY "repairs tenant insert own" ON public.repairs FOR INSERT TO authenticated
  WITH CHECK (tenant_user_id = auth.uid() AND status = 'pending');