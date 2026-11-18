-- Public QR images are displayed on tenant invoices; only the dorm owner can upload them.
begin;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dorm-assets', 'dorm-assets', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "dorm_assets_public_read" on storage.objects;
create policy "dorm_assets_public_read" on storage.objects for select to public using (bucket_id = 'dorm-assets');
drop policy if exists "dorm_assets_owner_upload" on storage.objects;
create policy "dorm_assets_owner_upload" on storage.objects for insert to authenticated with check (bucket_id = 'dorm-assets' and public.current_user_is_owner());
commit;
