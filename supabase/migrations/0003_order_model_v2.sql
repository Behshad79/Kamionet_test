-- v2 order model: two-ended temperature band, vehicle type/capacity matching, declared cargo value
-- as the insurance basis, pickup window + delivery deadline, payment terms, cancellation fee.

alter table orders
  add column required_temp_min numeric not null default -30,
  add column vehicle_type text not null default 'truck10' check (vehicle_type in ('pickup','khavar','truck10','trailer')),
  add column weight_kg int not null default 1 check (weight_kg > 0),
  add column pallets int,
  add column volume_m3 numeric,
  add column declared_value bigint not null default 0,
  add column pickup_to timestamptz,
  add column deliver_by timestamptz,
  add column payment_method text not null default 'prepaid' check (payment_method in ('prepaid','deposit','cod')),
  add column deposit_pct int check (deposit_pct between 1 and 90),
  add column cancel_fee bigint;
update orders set pickup_to = pickup_at + interval '2 hours', deliver_by = pickup_at + interval '12 hours' where pickup_to is null;
alter table orders
  alter column pickup_to set not null, alter column deliver_by set not null,
  alter column required_temp_min drop default, alter column vehicle_type drop default,
  alter column weight_kg drop default, alter column declared_value drop default,
  alter column payment_method drop default,
  add constraint temp_band check (required_temp_min <= required_temp_max),
  add constraint windows check (pickup_to > pickup_at and deliver_by > pickup_to),
  add constraint deposit_needs_pct check ((payment_method = 'deposit') = (deposit_pct is not null));

alter table driver_profiles add column capacity_kg int not null default 0;

update app_config set value = '0.003' where key = 'insurance_rate';
insert into app_config values ('cancel_fee_pct', '0.1');

-- Full vehicle match: type AND payload AND fridge. Never temperature alone.
create function vehicle_matches(d driver_profiles, o orders) returns boolean language sql immutable as $$
  select d.vehicle_type = o.vehicle_type and d.capacity_kg >= o.weight_kg and d.min_temp_capacity <= o.required_temp_max
$$;

drop policy orders_read on orders;
create policy orders_read on orders for select using (
  shipper_id = auth.uid() or driver_id = auth.uid() or locked_by = auth.uid()
  or (status = 'OPEN' and exists (select 1 from driver_profiles d where d.user_id = auth.uid() and vehicle_matches(d, orders)))
);

drop function create_order(text,text,double precision,double precision,text,double precision,double precision,text,int,timestamptz,text,numeric,bigint,boolean,int,text);
create function create_order(
  p_origin_city text, p_dest_city text,
  p_origin_lat double precision, p_origin_lng double precision, p_origin_address text,
  p_dest_lat double precision, p_dest_lng double precision, p_dest_address text,
  p_distance_km int, p_pickup_from timestamptz, p_pickup_to timestamptz, p_deliver_by timestamptz,
  p_cargo text, p_temp_min numeric, p_temp_max numeric,
  p_vehicle_type text, p_weight_kg int, p_declared_value bigint,
  p_price bigint, p_payment_method text, p_deposit_pct int, p_insurance boolean,
  p_count int default 1, p_note text default null, p_pallets int default null, p_volume_m3 numeric default null
) returns setof uuid language plpgsql security definer set search_path = public as $$
declare i int; v_id uuid; v_ins boolean; v_gid uuid := gen_random_uuid();
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_declared_value < 1000000 then raise exception 'DECLARED_VALUE_REQUIRED'; end if;
  v_ins := (cfg('insurance_mode') = '"mandatory"') or p_insurance;
  for i in 1..greatest(1, least(p_count, 10)) loop
    insert into orders(group_id, shipper_id, origin_city, dest_city, distance_km, pickup_at, pickup_to, deliver_by, cargo,
                       required_temp_min, required_temp_max, vehicle_type, weight_kg, pallets, volume_m3, declared_value,
                       price, payment_method, deposit_pct, insurance, insurance_fee)
    values (v_gid, auth.uid(), p_origin_city, p_dest_city, p_distance_km, p_pickup_from, p_pickup_to, p_deliver_by, p_cargo,
            p_temp_min, p_temp_max, p_vehicle_type, p_weight_kg, p_pallets, p_volume_m3, p_declared_value,
            p_price, p_payment_method, p_deposit_pct, v_ins,
            -- premium = share of DECLARED CARGO VALUE, not of the fare
            case when v_ins then round(p_declared_value * (cfg('insurance_rate'))::text::numeric, -3) else 0 end)
    returning id into v_id;
    update orders set
      origin_area_lat = fuzz(p_origin_lat, v_id::text, 1), origin_area_lng = fuzz(p_origin_lng, v_id::text, 2),
      dest_area_lat   = fuzz(p_dest_lat,   v_id::text, 3), dest_area_lng   = fuzz(p_dest_lng,   v_id::text, 4)
    where id = v_id;
    insert into order_private values (v_id, p_origin_address, p_dest_address, p_origin_lat, p_origin_lng, p_dest_lat, p_dest_lng, p_note);
    return next v_id;
  end loop;
end $$;

create or replace function claim_order(p_order uuid) returns void language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; d driver_profiles%rowtype;
begin
  perform reap_locks();
  select * into d from driver_profiles where user_id = auth.uid();
  if not found or driver_standing(d) <> 'verified' then raise exception 'NOT_VERIFIED'; end if;
  if exists (select 1 from orders where status = 'LOCKED' and locked_by = auth.uid()) then raise exception 'ALREADY_HOLDING_LOCK'; end if;

  select * into o from orders where id = p_order for update skip locked;
  if not found then raise exception 'ALREADY_TAKEN'; end if;
  if o.shipper_id = auth.uid() then raise exception 'OWN_ORDER'; end if;
  if o.status <> 'OPEN' then raise exception 'ALREADY_TAKEN'; end if;
  if d.vehicle_type <> o.vehicle_type then raise exception 'TYPE_MISMATCH'; end if;
  if d.capacity_kg < o.weight_kg then raise exception 'CAPACITY_MISMATCH'; end if;
  if d.min_temp_capacity > o.required_temp_max then raise exception 'TEMP_MISMATCH'; end if;

  update orders set status = 'LOCKED', locked_by = auth.uid(),
         locked_until = now() + make_interval(secs => (cfg('lock_seconds'))::text::int)
   where id = p_order;
end $$;

-- Free before a driver is committed; a fee applies once one is assigned.
create or replace function cancel_order(p_order uuid) returns void language plpgsql security definer set search_path = public as $$
declare o orders%rowtype;
begin
  select * into o from orders where id = p_order for update;
  if not found or o.shipper_id <> auth.uid() or o.status not in ('OPEN','LOCKED','ASSIGNED') then raise exception 'INVALID_TRANSITION'; end if;
  update orders set status = 'CANCELLED', locked_by = null, locked_until = null,
         cancel_fee = case when o.status = 'ASSIGNED' then round(o.price * (cfg('cancel_fee_pct'))::text::numeric, -3)::bigint end
   where id = p_order;
end $$;
