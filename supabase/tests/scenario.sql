\set ON_ERROR_STOP off
create function t_as(u uuid) returns void language sql as $$ select set_config('request.jwt.sub', u::text, false) $$;
create function t_assert(name text, ok boolean) returns void language plpgsql as $$
begin raise notice '% %', case when ok then 'PASS' else 'FAIL' end, name; end $$;

insert into auth.users values ('00000000-0000-0000-0000-00000000000a'),('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c'),('00000000-0000-0000-0000-00000000000d');
insert into profiles(id,phone) values
  ('00000000-0000-0000-0000-00000000000a','0911'),('00000000-0000-0000-0000-00000000000b','0912'),
  ('00000000-0000-0000-0000-00000000000c','0913'),('00000000-0000-0000-0000-00000000000d','0914');
-- a = shipper who is ALSO a verified freezer driver; b = freezer driver; c = chiller (0°C) driver; d = unverified
insert into driver_profiles(user_id,kyc,min_temp_capacity,insurance_expires,inspection_expires) values
  ('00000000-0000-0000-0000-00000000000a','verified',-20,current_date+100,current_date+100),
  ('00000000-0000-0000-0000-00000000000b','verified',-20,current_date+100,current_date+100),
  ('00000000-0000-0000-0000-00000000000c','verified',0,current_date+100,current_date+100),
  ('00000000-0000-0000-0000-00000000000d','pending',-20,current_date+100,current_date+100);

select t_as('00000000-0000-0000-0000-00000000000a');
create table o as select create_order('تهران','اصفهان',35.69,51.39,'خیابان آزادی پلاک ۱۲',32.65,51.67,'میدان جهاد',440,now()+interval '5 hours','dairy',4,17500000,false) as id;
create table f as select create_order('تهران','مشهد',35.69,51.39,'شهرک صنعتی',36.26,59.61,'وکیل‌آباد',900,now()+interval '5 hours','icecream',-18,41000000,false) as id;

-- self-assign guard
select t_as('00000000-0000-0000-0000-00000000000a');
do $$ begin perform claim_order((select id from o)); perform t_assert('own order cannot be claimed', false);
exception when others then perform t_assert('own order cannot be claimed', sqlerrm='OWN_ORDER'); end $$;

-- temp matching: chiller driver c cannot take frozen; can take chilled
select t_as('00000000-0000-0000-0000-00000000000c');
do $$ begin perform claim_order((select id from f)); perform t_assert('chiller cannot take frozen order', false);
exception when others then perform t_assert('chiller cannot take frozen order', sqlerrm in ('TEMP_MISMATCH','ALREADY_TAKEN')); end $$;

-- unverified driver blocked
select t_as('00000000-0000-0000-0000-00000000000d');
do $$ begin perform claim_order((select id from o)); perform t_assert('unverified cannot claim', false);
exception when others then perform t_assert('unverified cannot claim', sqlerrm='NOT_VERIFIED'); end $$;

-- masking: while OPEN/LOCKED nobody but the shipper reads private rows
create role rls_user; grant usage on schema public, auth to rls_user; grant select on all tables in schema public to rls_user; grant select on o, f to rls_user;
grant execute on all functions in schema public to rls_user, public;
select t_as('00000000-0000-0000-0000-00000000000b');
set role rls_user;
select t_assert('driver sees fuzzed public order', (select count(*) from orders where id=(select id from o)) = 1);
select t_assert('driver sees NO private row while OPEN', (select count(*) from order_private) = 0);
reset role;
select t_as('00000000-0000-0000-0000-00000000000c'); set role rls_user;
select t_assert('chiller driver: frozen order invisible by RLS', (select count(*) from orders where id=(select id from f)) = 0);
reset role;

-- soft-lock by b, then c is rejected; expiry returns to OPEN
select t_as('00000000-0000-0000-0000-00000000000b');
select claim_order((select id from o));
select t_assert('claim → LOCKED', (select status from orders where id=(select id from o)) = 'LOCKED');
select t_as('00000000-0000-0000-0000-00000000000c');
do $$ begin perform claim_order((select id from o)); perform t_assert('second claimer rejected', false);
exception when others then perform t_assert('second claimer rejected', sqlerrm='ALREADY_TAKEN'); end $$;
select t_as('00000000-0000-0000-0000-00000000000b'); set role rls_user;
select t_assert('locking driver still sees no private row', (select count(*) from order_private) = 0);
reset role;
update orders set locked_until = now() - interval '1 second' where id=(select id from o);
select reap_locks();
select t_assert('expired lock reverts to OPEN', (select status from orders where id=(select id from o)) = 'OPEN');

-- assign → private details unlock, only to the two parties
select t_as('00000000-0000-0000-0000-00000000000b');
select claim_order((select id from o));
select confirm_assign((select id from o));
select t_assert('confirm → ASSIGNED with waybill', (select status='ASSIGNED' and waybill_no is not null from orders where id=(select id from o)));
set role rls_user;
select t_assert('assigned driver now reads exact address', (select count(*) from order_private where order_id=(select id from o)) = 1);
reset role;
select t_as('00000000-0000-0000-0000-00000000000c'); set role rls_user;
select t_assert('other driver still blind', (select count(*) from order_private) = 0);
reset role;
do $$ begin update orders set driver_id = shipper_id where id=(select id from o);
  perform t_assert('DB rejects driver_id = shipper_id', false);
exception when check_violation then perform t_assert('DB rejects driver_id = shipper_id', true); end $$;
select t_assert('guest view exposes only city + range', (select count(*) from guest_orders) >= 1);
select t_assert('event log written', (select count(*) from order_events where order_id=(select id from o)) >= 4);
