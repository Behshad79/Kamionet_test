-- ───────── RPC: the only way to change an order ─────────

create function create_order(
  p_origin_city text, p_dest_city text,
  p_origin_lat double precision, p_origin_lng double precision, p_origin_address text,
  p_dest_lat double precision, p_dest_lng double precision, p_dest_address text,
  p_distance_km int, p_pickup_at timestamptz, p_cargo text, p_temp_max numeric,
  p_price bigint, p_insurance boolean, p_count int default 1, p_note text default null
) returns setof uuid language plpgsql security definer set search_path = public as $$
declare i int; v_id uuid; v_ins boolean; v_gid uuid := gen_random_uuid();
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_ins := (cfg('insurance_mode') = '"mandatory"') or p_insurance;      -- mandatory mode is server-enforced
  for i in 1..greatest(1, least(p_count, 10)) loop
    insert into orders(group_id, shipper_id, origin_city, dest_city, distance_km, pickup_at, cargo,
                       required_temp_max, price, insurance, insurance_fee)
    values (v_gid, auth.uid(), p_origin_city, p_dest_city, p_distance_km, p_pickup_at, p_cargo,
            p_temp_max, p_price, v_ins,
            case when v_ins then round(p_price * (cfg('insurance_rate'))::text::numeric, -3) else 0 end)
    returning id into v_id;
    update orders set
      origin_area_lat = fuzz(p_origin_lat, v_id::text, 1), origin_area_lng = fuzz(p_origin_lng, v_id::text, 2),
      dest_area_lat   = fuzz(p_dest_lat,   v_id::text, 3), dest_area_lng   = fuzz(p_dest_lng,   v_id::text, 4)
    where id = v_id;
    insert into order_private values (v_id, p_origin_address, p_dest_address,
      p_origin_lat, p_origin_lng, p_dest_lat, p_dest_lng, p_note);
    return next v_id;
  end loop;
end $$;

-- Release expired soft-locks and expire stale orders. Run every 10s via pg_cron.
create function reap_locks() returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update orders set status = 'OPEN', locked_by = null, locked_until = null
   where status = 'LOCKED' and locked_until <= now();
  get diagnostics n = row_count;
  update orders set status = 'EXPIRED' where status = 'OPEN' and pickup_at < now() - interval '2 hours';
  return n;
end $$;

-- OPEN → LOCKED. Row lock guarantees exactly one winner.
create function claim_order(p_order uuid) returns void language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; d driver_profiles%rowtype;
begin
  perform reap_locks();
  select * into d from driver_profiles where user_id = auth.uid();
  if not found or driver_standing(d) <> 'verified' then raise exception 'NOT_VERIFIED'; end if;
  if exists (select 1 from orders where status = 'LOCKED' and locked_by = auth.uid()) then raise exception 'ALREADY_HOLDING_LOCK'; end if;

  select * into o from orders where id = p_order for update skip locked;   -- concurrent claimers skip, don't wait
  if not found then raise exception 'ALREADY_TAKEN'; end if;
  if o.shipper_id = auth.uid() then raise exception 'OWN_ORDER'; end if;
  if o.status <> 'OPEN' then raise exception 'ALREADY_TAKEN'; end if;
  if d.min_temp_capacity > o.required_temp_max then raise exception 'TEMP_MISMATCH'; end if;

  update orders set status = 'LOCKED', locked_by = auth.uid(),
         locked_until = now() + make_interval(secs => (cfg('lock_seconds'))::text::int)
   where id = p_order;
end $$;

create function release_lock(p_order uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  update orders set status = 'OPEN', locked_by = null, locked_until = null
   where id = p_order and status = 'LOCKED' and locked_by = auth.uid();
end $$;

-- LOCKED → ASSIGNED (details unlock via RLS on order_private)
create function confirm_assign(p_order uuid) returns text language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; no text;
begin
  select * into o from orders where id = p_order for update;
  if not found or o.status <> 'LOCKED' or o.locked_by <> auth.uid() or o.locked_until <= now() then raise exception 'LOCK_EXPIRED'; end if;
  no := 'KM-' || to_char(now(), 'YY') || lpad(nextval('waybill_seq')::text, 6, '0');
  update orders set status = 'ASSIGNED', driver_id = locked_by, locked_by = null, locked_until = null,
         assigned_at = now(), waybill_no = no where id = p_order;
  return no;
end $$;
create sequence waybill_seq;

create function start_trip(p_order uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from order_media where order_id = p_order and kind in ('cargo','invoice_pickup')) < 2
    then raise exception 'PICKUP_DOCS_REQUIRED'; end if;
  update orders set status = 'IN_TRANSIT', started_at = now()
   where id = p_order and status = 'ASSIGNED' and driver_id = auth.uid();
  if not found then raise exception 'INVALID_TRANSITION'; end if;
end $$;

create function deliver_order(p_order uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from order_media where order_id = p_order and kind = 'invoice_delivery') then raise exception 'INVOICE_REQUIRED'; end if;
  update orders set status = 'DELIVERED', delivered_at = now()
   where id = p_order and status = 'IN_TRANSIT' and driver_id = auth.uid();
  if not found then raise exception 'INVALID_TRANSITION'; end if;
end $$;

create function cancel_order(p_order uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  update orders set status = 'CANCELLED', locked_by = null, locked_until = null
   where id = p_order and shipper_id = auth.uid() and status in ('OPEN','LOCKED','ASSIGNED');
  if not found then raise exception 'INVALID_TRANSITION'; end if;
end $$;

-- ───────── Row-level security ─────────
alter table orders         enable row level security;
alter table order_private  enable row level security;
alter table order_media    enable row level security;
alter table driver_profiles enable row level security;
alter table profiles       enable row level security;

-- Public part: own orders, or OPEN/LOCKED orders for verified drivers whose fridge fits.
create policy orders_read on orders for select using (
  shipper_id = auth.uid() or driver_id = auth.uid() or locked_by = auth.uid()
  or (status = 'OPEN' and exists (
        select 1 from driver_profiles d
         where d.user_id = auth.uid() and d.min_temp_capacity <= orders.required_temp_max))
);
-- Private part: only the shipper, or the driver once ASSIGNED+. Never during OPEN/LOCKED.
create policy private_read on order_private for select using (exists (
  select 1 from orders o where o.id = order_id and (
    o.shipper_id = auth.uid()
    or (o.driver_id = auth.uid() and o.status in ('ASSIGNED','IN_TRANSIT','DELIVERED')))
));
create policy media_read on order_media for select using (exists (
  select 1 from orders o where o.id = order_id and (o.shipper_id = auth.uid() or o.driver_id = auth.uid())));
create policy driver_self on driver_profiles for select using (user_id = auth.uid());
create policy profile_read on profiles for select using (
  id = auth.uid()
  or exists (select 1 from orders o where (o.shipper_id = auth.uid() and o.driver_id = profiles.id)
                                       or (o.driver_id = auth.uid() and o.shipper_id = profiles.id))
);
-- No INSERT/UPDATE/DELETE policies on orders: writes only via the RPCs above.

-- Guests: city + rounded price range, nothing else.
create view guest_orders as
  select id, origin_city, dest_city,
         (floor(price * 0.9 / 1000000) * 1000000)::bigint as price_min,
         (ceil(price * 1.1 / 1000000) * 1000000)::bigint as price_max
    from orders where status = 'OPEN';
