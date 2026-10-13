ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
UPDATE public.profiles p SET email = u.email FROM auth.users u WHERE u.id = p.id AND p.email IS NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
begin
  insert into public.profiles (id, full_name, email) values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), new.email);
  if not exists (select 1 from public.user_roles where role = 'owner') then
    insert into public.user_roles (user_id, role) values (new.id, 'owner');
  else
    insert into public.user_roles (user_id, role) values (new.id, 'tenant');
  end if;
  return new;
end; $$;

CREATE OR REPLACE FUNCTION public.set_user_role(_user_id uuid, _role app_role)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
begin
  if not public.has_role(auth.uid(), 'owner') then raise exception 'เฉพาะเจ้าของเท่านั้น'; end if;
  if _user_id = auth.uid() then raise exception 'ไม่สามารถเปลี่ยนบทบาทของตัวเองได้'; end if;
  delete from public.user_roles where user_id = _user_id;
  insert into public.user_roles (user_id, role) values (_user_id, _role);
end; $$;

CREATE OR REPLACE FUNCTION public.link_tenant(_rental_id uuid, _user_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
begin
  if not public.is_staff(auth.uid()) then raise exception 'ไม่มีสิทธิ์'; end if;
  update public.rentals set tenant_user_id = _user_id where id = _rental_id;
  update public.bills set tenant_user_id = _user_id where rental_id = _rental_id;
end; $$;

REVOKE ALL ON FUNCTION public.set_user_role(uuid, app_role) FROM public, anon;
REVOKE ALL ON FUNCTION public.link_tenant(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_tenant(uuid, uuid) TO authenticated;