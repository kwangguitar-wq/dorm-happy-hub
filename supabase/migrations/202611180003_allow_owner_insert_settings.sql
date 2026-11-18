-- Allow the owner to create the singleton settings row when it is missing.
-- Keep the settings table restricted to staff reads and owner writes.
begin;

drop policy if exists "settings_owner_insert" on public.settings;
create policy "settings_owner_insert"
on public.settings
for insert
to authenticated
with check (
  public.current_user_is_owner()
  and id = 1
);

-- Ensure the singleton row exists for the upsert used by the rates form.
insert into public.settings (id, water_rate, electric_rate)
values (1, 0, 0)
on conflict (id) do nothing;

commit;
