CREATE TABLE public.settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  water_rate numeric NOT NULL DEFAULT 18,
  electric_rate numeric NOT NULL DEFAULT 8,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings read" ON public.settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings staff write" ON public.settings FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
INSERT INTO public.settings (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE public.bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  rental_id uuid REFERENCES public.rentals(id) ON DELETE SET NULL,
  tenant_user_id uuid,
  bill_month date NOT NULL,
  water_prev numeric NOT NULL DEFAULT 0,
  water_curr numeric NOT NULL DEFAULT 0,
  electric_prev numeric NOT NULL DEFAULT 0,
  electric_curr numeric NOT NULL DEFAULT 0,
  water_rate numeric NOT NULL DEFAULT 0,
  electric_rate numeric NOT NULL DEFAULT 0,
  rent numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'unpaid',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, bill_month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bills TO authenticated;
GRANT ALL ON public.bills TO service_role;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bills staff all" ON public.bills FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "bills tenant read own" ON public.bills FOR SELECT TO authenticated USING (tenant_user_id = auth.uid());