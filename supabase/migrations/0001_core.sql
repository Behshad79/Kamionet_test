-- Kamionet core schema. Target: Supabase (Postgres 15+). Every state transition
-- is a SECURITY DEFINER function; clients never UPDATE orders directly.

create type order_status as enum ('DRAFT','OPEN','LOCKED','ASSIGNED','IN_TRANSIT','DELIVERED','CANCELLED','EXPIRED');
create type kyc_status   as enum ('none','draft','pending','verified','rejected');

create table app_config (
  key text primary key, value jsonb not null
);
insert into app_config values
  ('insurance_mode','"optional"'), ('insurance_rate','0.015'),
  ('lock_seconds','150'), ('commission','0.2');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text unique not null,
  full_name text not null default '',
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table driver_profiles (
  user_id uuid primary key references profiles(id) on delete cascade,
  kyc kyc_status not null default 'none',
  reject_reason text,
  vehicle_type text not null default 'truck',
  plate text not null default '',
  fridge_brand text not null default '',
  min_temp_capacity numeric not null default 0,      -- vehicle.min_temp_capacity
  insurance_expires date,
  inspection_expires date,
  submitted_at timestamptz
);

-- Public part of an order: what any verified driver may see.
create table orders (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null default gen_random_uuid(),
  shipper_id uuid not null references profiles(id),
  driver_id uuid references profiles(id),
  status order_status not null default 'OPEN',
  origin_city text not null, dest_city text not null,
  origin_area_lat double precision, origin_area_lng double precision,   -- fuzzed, server-side
  dest_area_lat   double precision, dest_area_lng   double precision,
  distance_km int not null,
  pickup_at timestamptz not null,
  cargo text not null,
  required_temp_max numeric not null,
  price bigint not null check (price > 0),
  insurance boolean not null default false,
  insurance_fee bigint not null default 0,
  locked_by uuid references profiles(id),
  locked_until timestamptz,
  waybill_no text unique,
  created_at timestamptz not null default now(),
  assigned_at timestamptz, started_at timestamptz, delivered_at timestamptz,
  constraint no_self_assign check (driver_id is null or driver_id <> shipper_id),
  constraint no_self_lock   check (locked_by is null or locked_by <> shipper_id),
  constraint lock_consistency check ((status = 'LOCKED') = (locked_by is not null and locked_until is not null))
);
create index orders_open_idx on orders (status, required_temp_max) where status in ('OPEN','LOCKED');

-- Private part: exact points, names, phones. Separate table => separate RLS.
create table order_private (
  order_id uuid primary key references orders(id) on delete cascade,
  origin_address text not null, dest_address text not null,
  origin_lat double precision not null, origin_lng double precision not null,
  dest_lat   double precision not null, dest_lng   double precision not null,
  note text
);

create table order_media (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  kind text not null check (kind in ('cargo','invoice_pickup','invoice_delivery')),
  storage_path text not null, taken_at timestamptz not null,
  lat double precision, lng double precision, items int
);

create table order_events (
  id bigserial primary key,
  order_id uuid not null references orders(id) on delete cascade,
  from_status order_status, to_status order_status not null,
  actor uuid, at timestamptz not null default now()
);

create table rate_table (
  id uuid primary key default gen_random_uuid(),
  from_city text not null, to_city text not null, min_price bigint not null, max_price bigint not null
);

-- ───────── helpers ─────────
create function cfg(k text) returns jsonb language sql stable as $$ select value from app_config where key = k $$;

create function fuzz(p double precision, seed text, salt int) returns double precision
language sql immutable as $$
  select round(p / 0.04) * 0.04
       + ((('x' || substr(md5(seed || salt), 1, 6))::bit(24)::int % 1000) / 1000.0 - 0.5) * 0.03
$$;

create function orders_before_insert() returns trigger language plpgsql as $$
begin
  new.status := 'OPEN';
  return new;
end $$;

create function driver_standing(d driver_profiles) returns text language sql stable as $$
  select case
    when d.kyc = 'verified' and (d.insurance_expires < current_date or d.inspection_expires < current_date) then 'suspended'
    else d.kyc::text end
$$;

create function log_event() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into order_events(order_id, from_status, to_status, actor)
    values (new.id, case when tg_op = 'UPDATE' then old.status end, new.status, auth.uid());
  end if;
  return new;
end $$;
create trigger orders_log after insert or update on orders for each row execute function log_event();
