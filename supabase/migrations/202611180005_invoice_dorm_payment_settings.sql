-- Add dorm identity, due-date policy and payment channels used on invoices.
begin;
alter table public.settings
  add column if not exists dorm_name text,
  add column if not exists dorm_address text,
  add column if not exists dorm_phone text,
  add column if not exists dorm_email text,
  add column if not exists due_day integer not null default 5 check (due_day between 1 and 28),
  add column if not exists late_fee_note text,
  add column if not exists bank_name text,
  add column if not exists bank_account_name text,
  add column if not exists bank_account_number text,
  add column if not exists promptpay_id text,
  add column if not exists payment_note text,
  add column if not exists payment_qr_url text;
update public.settings set dorm_name = coalesce(dorm_name, 'หอพักแม่ปะ 409') where id = 1;
commit;
