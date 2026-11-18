-- Preserve tenant history when an Auth account is removed and later recreated with the same email.
begin;

create table if not exists public.tenant_customers (
  id uuid primary key default gen_random_uuid(),
  normalized_email text not null unique,
  full_name text not null default '',
  phone text,
  created_at timestamptz not null default now(),
  auth_user_id uuid references auth.users(id) on delete set null
);

alter table public.tenant_customers enable row level security;
drop policy if exists "tenant_customers_staff_manage" on public.tenant_customers;
create policy "tenant_customers_staff_manage" on public.tenant_customers
  for all to authenticated
  using (public.current_user_is_staff())
  with check (public.current_user_is_staff());
grant select, insert, update, delete on public.tenant_customers to authenticated;

alter table public.rentals add column if not exists customer_id uuid references public.tenant_customers(id) on delete set null;
alter table public.bills add column if not exists customer_id uuid references public.tenant_customers(id) on delete set null;
alter table public.payments add column if not exists customer_id uuid references public.tenant_customers(id) on delete set null;
alter table public.repairs add column if not exists customer_id uuid references public.tenant_customers(id) on delete set null;

-- Preserve payment rows instead of cascading them away when an Auth user is deleted.
alter table public.payments alter column tenant_user_id drop not null;
alter table public.payments drop constraint if exists payments_tenant_user_id_fkey;
alter table public.payments add constraint payments_tenant_user_id_fkey
  foreign key (tenant_user_id) references auth.users(id) on delete set null;

-- Backfill durable customer records from existing tenant profiles and rental records.
insert into public.tenant_customers (normalized_email, full_name, phone, auth_user_id)
select lower(trim(p.email)), coalesce(p.full_name, ''), p.phone, p.id
from public.profiles p
where p.email is not null and trim(p.email) <> ''
on conflict (normalized_email) do update
set full_name = case when public.tenant_customers.full_name = '' then excluded.full_name else public.tenant_customers.full_name end,
    phone = coalesce(public.tenant_customers.phone, excluded.phone),
    auth_user_id = coalesce(public.tenant_customers.auth_user_id, excluded.auth_user_id);

insert into public.tenant_customers (normalized_email, full_name, phone)
select lower(trim(r.email)), max(r.tenant_name), max(r.phone)
from public.rentals r
where r.email is not null and trim(r.email) <> ''
group by lower(trim(r.email))
on conflict (normalized_email) do nothing;

update public.rentals r set customer_id = c.id
from public.tenant_customers c
where r.customer_id is null and r.email is not null and c.normalized_email = lower(trim(r.email));

update public.bills b set customer_id = c.id
from public.profiles p join public.tenant_customers c on c.normalized_email = lower(trim(p.email))
where b.customer_id is null and b.tenant_user_id = p.id;

update public.payments p set customer_id = c.id
from public.profiles pr join public.tenant_customers c on c.normalized_email = lower(trim(pr.email))
where p.customer_id is null and p.tenant_user_id = pr.id;

update public.repairs r set customer_id = c.id
from public.profiles p join public.tenant_customers c on c.normalized_email = lower(trim(p.email))
where r.customer_id is null and r.tenant_user_id = p.id;

create index if not exists rentals_customer_id_idx on public.rentals(customer_id);
create index if not exists bills_customer_id_idx on public.bills(customer_id);
create index if not exists payments_customer_id_idx on public.payments(customer_id);
create index if not exists repairs_customer_id_idx on public.repairs(customer_id);

-- On signup with a previously registered email, reconnect the new Auth UID to
-- the existing durable customer and all retained tenant records.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  assigned_role public.app_role;
  matched_customer_id uuid;
begin
  select c.id into matched_customer_id
  from public.tenant_customers c
  where c.normalized_email = lower(trim(coalesce(new.email, '')))
  limit 1;

  assigned_role := case
    when lower(coalesce(new.email, '')) = 'kwangguitar@gmail.com'
      then 'owner'::public.app_role
    else 'tenant'::public.app_role
  end;

  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = case when public.profiles.full_name = '' then excluded.full_name else public.profiles.full_name end;

  insert into public.user_roles (user_id, role)
  values (new.id, assigned_role)
  on conflict (user_id, role) do nothing;

  if matched_customer_id is not null then
    update public.tenant_customers
      set auth_user_id = new.id
      where id = matched_customer_id;
    update public.rentals set tenant_user_id = new.id where customer_id = matched_customer_id;
    update public.bills set tenant_user_id = new.id where customer_id = matched_customer_id;
    update public.payments set tenant_user_id = new.id where customer_id = matched_customer_id;
    update public.repairs set tenant_user_id = new.id where customer_id = matched_customer_id;
  end if;

  return new;
end;
$$;

commit;
