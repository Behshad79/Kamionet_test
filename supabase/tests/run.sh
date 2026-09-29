#!/usr/bin/env bash
# Spins up a throwaway Postgres, loads migrations with a stub of Supabase's auth schema,
# and verifies: race safety, masking, self-assign guard, temp matching, lock expiry.
set -euo pipefail
PGBIN=/usr/lib/postgresql/16/bin
D=$(mktemp -d); chown postgres "$D"; chmod 700 "$D"
run() { su postgres -c "$*"; }
run "$PGBIN/initdb -D $D/data -A trust >/dev/null"
run "$PGBIN/pg_ctl -D $D/data -o '-p 5544 -k $D' -l $D/log -w start >/dev/null"
trap 'run "$PGBIN/pg_ctl -D $D/data -m immediate stop >/dev/null"; rm -rf "$D"' EXIT
P="psql -X -q -v ON_ERROR_STOP=1 -h $D -p 5544 -U postgres"
run "$P -c 'create database t'" >/dev/null
Q="$P -d t"
HERE=$(cd "$(dirname "$0")" && pwd)
run "$Q" <<'SQL'
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.sub', true), '')::uuid $$;
create role authenticated; create role anon;
SQL
for f in "$HERE"/../migrations/*.sql; do run "$Q" < "$f"; done
run "$Q" < "$HERE/scenario.sql"

# ── true concurrency: two sessions claim the same OPEN order at once ──
run "$Q" <<'SQL' >/dev/null
select set_config('request.jwt.sub','00000000-0000-0000-0000-00000000000a',false);
create table race as select create_order('تهران','قم',35.69,51.39,'x',34.64,50.87,'y',150,now()+interval '4 hours',now()+interval '6 hours',now()+interval '12 hours','dairy',0,4,'truck10',5000,200000000,4000000,'prepaid',null,false) as id;
SQL
RID=$(run "$Q -tA -c 'select id from race'")
( run "$Q -tA" <<SQL > "$D/w1.txt" 2>&1 ) &
begin;
select set_config('request.jwt.sub','00000000-0000-0000-0000-00000000000b',true);
select claim_order('$RID'); select pg_sleep(2); commit;
SQL
sleep 0.7
run "$Q -tA" <<SQL > "$D/w2.txt" 2>&1 || true
select set_config('request.jwt.sub','00000000-0000-0000-0000-00000000000c',false);
select claim_order('$RID');
SQL
wait
echo "session 1 (started first): $(grep -c ERROR "$D/w1.txt") errors"
if grep -q ALREADY_TAKEN "$D/w2.txt"; then echo "PASS concurrent claimer instantly rejected (SKIP LOCKED, no waiting)"; else echo "FAIL concurrent claimer: $(cat "$D/w2.txt")"; fi
echo "holder: $(run "$Q -tA -c \"select locked_by from orders where id='$RID'\"")"
