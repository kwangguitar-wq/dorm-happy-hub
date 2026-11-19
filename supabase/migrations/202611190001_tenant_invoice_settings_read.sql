-- Allow signed-in tenants to read the dorm/payment settings shown on their invoices.
-- Writes remain restricted to the owner by the existing settings_owner_update policy.
begin;
drop policy if exists "settings_authenticated_read" on public.settings;
create policy "settings_authenticated_read" on public.settings
  for select to authenticated
  using (true);
commit;
