-- Dorm Happy Hub initial schema
-- Project: uagfvtuxeljhwszjfvzh
-- Apply once in the Supabase SQL Editor for this project.
-- Creates application tables, role helpers, RLS policies, RPCs and the payment-slip bucket.
-- Does not delete existing data. Safe to re-run for the initial empty database.

begin;

create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('owner', 'staff', 'tenant');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text not null default '',
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'tenant',
  unique (user_id, role)
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  room_number text not null unique,
  floor integer not null default 1,
  room_type text not null default 'มาตรฐาน',
  monthly_rate numeric(12,2) not null default 0,
  daily_rate numeric(12,2) not null default 0,
  status text not null default 'vacant',
  notes text,
  created_at timestamptz not null default now(),
  constraint rooms_status_check check (status in ('vacant','occupied','maintenance'))
);

create table if not exists public.rentals (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id),
  tenant_name text not null,
  email text,
  phone text,
  id_card text,
  rental_type text not null,
  check_in date not null default current_date,
  check_out date,
  rate numeric(12,2) not null default 0,
  deposit numeric(12,2) not null default 0,
  status text not null default 'active',
  notes text,
  tenant_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint rentals_type_check check (rental_type in ('daily','monthly')),
  constraint rentals_status_check check (status in ('active','completed','cancelled'))
);

create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id),
  rental_id uuid references public.rentals(id) on delete set null,
  tenant_user_id uuid references auth.users(id) on delete set null,
  bill_month date not null,
  bill_no text,
  receipt_no text,
  rent numeric(12,2) not null default 0,
  water_prev numeric(12,2) not null default 0,
  water_curr numeric(12,2) not null default 0,
  water_rate numeric(12,2) not null default 0,
  electric_prev numeric(12,2) not null default 0,
  electric_curr numeric(12,2) not null default 0,
  electric_rate numeric(12,2) not null default 0,
  other_fee numeric(12,2) not null default 0,
  other_note text,
  total numeric(12,2) not null default 0,
  status text not null default 'unpaid',
  due_date date,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  constraint bills_status_check check (status in ('unpaid','pending','paid','overdue','cancelled'))
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills(id) on delete cascade,
  tenant_user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null default 0,
  paid_on date not null default current_date,
  note text,
  slip_path text,
  status text not null default 'pending',
  ai_amount numeric(12,2),
  ai_paid_on date,
  ai_checked_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint payments_status_check check (status in ('pending','approved','rejected'))
);

create table if not exists public.repairs (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id) on delete set null,
  tenant_user_id uuid references auth.users(id) on delete set null,
  title text not null,
  detail text,
  status text not null default 'pending',
  staff_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint repairs_status_check check (status in ('pending','in_progress','completed','cancelled'))
);

create table if not exists public.settings (
  id integer primary key default 1,
  water_rate numeric(12,2) not null default 0,
  electric_rate numeric(12,2) not null default 0,
  updated_at timestamptz not null default now(),
  constraint settings_singleton_check check (id = 1)
);

insert into public.settings (id) values (1) on conflict (id) do nothing;

create index if not exists rentals_room_status_idx on public.rentals(room_id, status);
create index if not exists rentals_tenant_user_idx on public.rentals(tenant_user_id);
create index if not exists bills_room_month_idx on public.bills(room_id, bill_month desc);
create index if not exists bills_tenant_user_idx on public.bills(tenant_user_id);
create index if not exists payments_bill_idx on public.payments(bill_id, created_at desc);
create index if not exists payments_tenant_idx on public.payments(tenant_user_id);
create index if not exists repairs_tenant_idx on public.repairs(tenant_user_id, created_at desc);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

create or replace function public.is_staff(_user_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.has_role(_user_id, 'owner'::public.app_role)
      or public.has_role(_user_id, 'staff'::public.app_role);
$$;

create or replace function public.current_user_is_owner()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.has_role(auth.uid(), 'owner'::public.app_role);
$$;

create or replace function public.current_user_is_staff()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_staff(auth.uid());
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  assigned_role public.app_role;
begin
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

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_dorm_happy on auth.users;
create trigger on_auth_user_created_dorm_happy
after insert on auth.users
for each row execute function public.handle_new_user();

-- Backfill profile/role for accounts that already exist.
insert into public.profiles (id, email, full_name)
select id, email, coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name', '')
from auth.users
on conflict (id) do update set email = excluded.email;

insert into public.user_roles (user_id, role)
select id,
  case when lower(coalesce(email, '')) = 'kwangguitar@gmail.com'
    then 'owner'::public.app_role else 'tenant'::public.app_role end
from auth.users
where not exists (
  select 1 from public.user_roles ur where ur.user_id = auth.users.id
);

-- Ensure the specified account is Owner, whether it had an earlier default role or not.
insert into public.user_roles (user_id, role)
select id, 'owner'::public.app_role
from auth.users
where lower(coalesce(email, '')) = 'kwangguitar@gmail.com'
on conflict (user_id, role) do nothing;

create or replace function public.set_user_role(_user_id uuid, _role public.app_role)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.current_user_is_owner() then
    raise exception 'Only an owner can change user roles';
  end if;
  if _user_id = auth.uid() and _role <> 'owner'::public.app_role then
    raise exception 'An owner cannot remove their own owner role';
  end if;
  insert into public.user_roles (user_id, role)
  values (_user_id, _role)
  on conflict (user_id, role) do nothing;
  if _role <> 'owner'::public.app_role then
    delete from public.user_roles
    where user_id = _user_id and role <> _role;
  end if;
end;
$$;

create or replace function public.link_tenant(_rental_id uuid, _user_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.current_user_is_staff() then
    raise exception 'Only staff or owner can link tenants';
  end if;
  update public.rentals
  set tenant_user_id = _user_id
  where id = _rental_id;
  if not found then raise exception 'Rental not found'; end if;
  update public.bills
  set tenant_user_id = _user_id
  where rental_id = _rental_id;
end;
$$;

create or replace function public.mark_bill_paid(_bill_id uuid)
returns text
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.current_user_is_staff() then
    raise exception 'Only staff or owner can mark a bill paid';
  end if;
  update public.bills
  set status = 'paid', paid_at = now()
  where id = _bill_id;
  if not found then raise exception 'Bill not found'; end if;
  update public.payments
  set status = 'approved', reviewed_at = now()
  where bill_id = _bill_id and status = 'pending';
  return 'paid';
end;
$$;

create or replace function public.touch_repair_updated_at()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists repairs_touch_updated_at on public.repairs;
create trigger repairs_touch_updated_at
before update on public.repairs
for each row execute function public.touch_repair_updated_at();

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.rooms enable row level security;
alter table public.rentals enable row level security;
alter table public.bills enable row level security;
alter table public.payments enable row level security;
alter table public.repairs enable row level security;
alter table public.settings enable row level security;

drop policy if exists "profiles_select_self_or_staff" on public.profiles;
create policy "profiles_select_self_or_staff" on public.profiles for select to authenticated
using (id = auth.uid() or public.current_user_is_staff());
drop policy if exists "profiles_update_self_or_owner" on public.profiles;
create policy "profiles_update_self_or_owner" on public.profiles for update to authenticated
using (id = auth.uid() or public.current_user_is_owner())
with check (id = auth.uid() or public.current_user_is_owner());

drop policy if exists "roles_select_self_or_staff" on public.user_roles;
create policy "roles_select_self_or_staff" on public.user_roles for select to authenticated
using (user_id = auth.uid() or public.current_user_is_staff());
drop policy if exists "roles_owner_manage" on public.user_roles;
create policy "roles_owner_manage" on public.user_roles for all to authenticated
using (public.current_user_is_owner()) with check (public.current_user_is_owner());

drop policy if exists "rooms_staff_all" on public.rooms;
create policy "rooms_staff_all" on public.rooms for all to authenticated
using (public.current_user_is_staff()) with check (public.current_user_is_staff());
drop policy if exists "rooms_tenant_read_linked" on public.rooms;
create policy "rooms_tenant_read_linked" on public.rooms for select to authenticated
using (exists (select 1 from public.rentals r where r.room_id = rooms.id and r.tenant_user_id = auth.uid() and r.status = 'active'));

drop policy if exists "rentals_staff_all" on public.rentals;
create policy "rentals_staff_all" on public.rentals for all to authenticated
using (public.current_user_is_staff()) with check (public.current_user_is_staff());
drop policy if exists "rentals_tenant_read_own" on public.rentals;
create policy "rentals_tenant_read_own" on public.rentals for select to authenticated
using (tenant_user_id = auth.uid());

drop policy if exists "bills_staff_all" on public.bills;
create policy "bills_staff_all" on public.bills for all to authenticated
using (public.current_user_is_staff()) with check (public.current_user_is_staff());
drop policy if exists "bills_tenant_read_own" on public.bills;
create policy "bills_tenant_read_own" on public.bills for select to authenticated
using (tenant_user_id = auth.uid());

drop policy if exists "payments_staff_all" on public.payments;
create policy "payments_staff_all" on public.payments for all to authenticated
using (public.current_user_is_staff()) with check (public.current_user_is_staff());
drop policy if exists "payments_tenant_read_own" on public.payments;
create policy "payments_tenant_read_own" on public.payments for select to authenticated
using (tenant_user_id = auth.uid());
drop policy if exists "payments_tenant_insert_own" on public.payments;
create policy "payments_tenant_insert_own" on public.payments for insert to authenticated
with check (
  tenant_user_id = auth.uid()
  and exists (
    select 1 from public.bills b
    where b.id = payments.bill_id and b.tenant_user_id = auth.uid()
  )
);

drop policy if exists "repairs_staff_all" on public.repairs;
create policy "repairs_staff_all" on public.repairs for all to authenticated
using (public.current_user_is_staff()) with check (public.current_user_is_staff());
drop policy if exists "repairs_tenant_read_own" on public.repairs;
create policy "repairs_tenant_read_own" on public.repairs for select to authenticated
using (tenant_user_id = auth.uid());
drop policy if exists "repairs_tenant_insert_own" on public.repairs;
create policy "repairs_tenant_insert_own" on public.repairs for insert to authenticated
with check (tenant_user_id = auth.uid());

drop policy if exists "settings_staff_read" on public.settings;
create policy "settings_staff_read" on public.settings for select to authenticated
using (public.current_user_is_staff());
drop policy if exists "settings_owner_update" on public.settings;
create policy "settings_owner_update" on public.settings for update to authenticated
using (public.current_user_is_owner()) with check (public.current_user_is_owner());

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles, public.user_roles, public.rooms,
  public.rentals, public.bills, public.payments, public.repairs, public.settings to authenticated;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.is_staff(uuid) to authenticated;
grant execute on function public.set_user_role(uuid, public.app_role) to authenticated;
grant execute on function public.link_tenant(uuid, uuid) to authenticated;
grant execute on function public.mark_bill_paid(uuid) to authenticated;

insert into storage.buckets (id, name, public)
values ('slips', 'slips', false)
on conflict (id) do nothing;

drop policy if exists "slips_tenant_upload_own" on storage.objects;
create policy "slips_tenant_upload_own" on storage.objects for insert to authenticated
with check (bucket_id = 'slips' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "slips_owner_staff_read" on storage.objects;
create policy "slips_owner_staff_read" on storage.objects for select to authenticated
using (bucket_id = 'slips' and public.current_user_is_staff());
drop policy if exists "slips_tenant_read_own" on storage.objects;
create policy "slips_tenant_read_own" on storage.objects for select to authenticated
using (bucket_id = 'slips' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "slips_owner_staff_delete" on storage.objects;
create policy "slips_owner_staff_delete" on storage.objects for delete to authenticated
using (bucket_id = 'slips' and public.current_user_is_staff());

commit;

-- Verify the owner account was found and promoted:
select u.email, ur.role
from auth.users u
join public.user_roles ur on ur.user_id = u.id
where lower(u.email) = lower('kwangguitar@gmail.com')
order by ur.role;
