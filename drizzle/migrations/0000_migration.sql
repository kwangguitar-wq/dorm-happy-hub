create type public.app_role as enum ('owner','staff','tenant');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role in ('owner','staff'))
$$;

create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid() or public.is_staff(auth.uid()));
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid());
create policy "own roles read" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.is_staff(auth.uid()));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''));
  if not exists (select 1 from public.user_roles where role = 'owner') then
    insert into public.user_roles (user_id, role) values (new.id, 'owner');
  else
    insert into public.user_roles (user_id, role) values (new.id, 'tenant');
  end if;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  room_number text not null unique,
  floor int not null default 1,
  room_type text not null default 'มาตรฐาน',
  monthly_rate numeric(10,2) not null default 0,
  daily_rate numeric(10,2) not null default 0,
  status text not null default 'vacant' check (status in ('vacant','occupied','maintenance')),
  notes text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.rooms to authenticated;
grant all on public.rooms to service_role;
alter table public.rooms enable row level security;
create policy "rooms read" on public.rooms for select to authenticated using (true);
create policy "rooms staff write" on public.rooms for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create table public.rentals (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete restrict,
  rental_type text not null check (rental_type in ('daily','monthly')),
  tenant_name text not null,
  phone text,
  id_card text,
  email text,
  tenant_user_id uuid,
  check_in date not null default current_date,
  check_out date,
  rate numeric(10,2) not null default 0,
  deposit numeric(10,2) not null default 0,
  status text not null default 'active' check (status in ('active','ended')),
  notes text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.rentals to authenticated;
grant all on public.rentals to service_role;
alter table public.rentals enable row level security;
create policy "rentals staff all" on public.rentals for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "rentals tenant read own" on public.rentals for select to authenticated using (tenant_user_id = auth.uid());

insert into public.rooms (room_number, floor, room_type, monthly_rate, daily_rate) values
('101',1,'มาตรฐาน',3500,450),('102',1,'มาตรฐาน',3500,450),('103',1,'มาตรฐาน',3500,450),
('104',1,'มาตรฐาน',3500,450),('105',1,'แอร์',4500,550),('106',1,'แอร์',4500,550);