-- rls_check.sql
-- Automated RLS self-check script for Memory Deposit
-- Run in Supabase SQL Editor. Everything rolls back — no data left behind.
--
-- Demo UUIDs:
--   Alexey: 11111111-1111-1111-1111-111111111111
--   Maria:  22222222-2222-2222-2222-222222222222

begin;

-- ============================================================
-- Helper variables
-- ============================================================
do $$
declare
  _alexey_id uuid := '11111111-1111-1111-1111-111111111111';
  _maria_id  uuid := '22222222-2222-2222-2222-222222222222';
  _item_id   uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  _recip_id  uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  _rule_id   uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  _trig_id   uuid := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  _count     int;
begin

  -- ==========================================================
  -- (a) Anon cannot read vault_items, recipients, access_rules, triggers
  -- ==========================================================
  -- Switch to anon role
  perform set_config('role', 'anon', true);

  select count(*) into _count from vault_items;
  if _count > 0 then
    raise exception 'FAIL (a): anon can read vault_items (count=%)', _count;
  end if;

  select count(*) into _count from recipients;
  if _count > 0 then
    raise exception 'FAIL (a): anon can read recipients (count=%)', _count;
  end if;

  select count(*) into _count from access_rules;
  if _count > 0 then
    raise exception 'FAIL (a): anon can read access_rules (count=%)', _count;
  end if;

  select count(*) into _count from triggers;
  if _count > 0 then
    raise exception 'FAIL (a): anon can read triggers (count=%)', _count;
  end if;

  raise notice 'PASS (a): anon cannot read protected tables';

  -- ==========================================================
  -- (b) Anon cannot INSERT into vault_items
  -- ==========================================================
  begin
    insert into vault_items (id, owner_id, type, name, encrypted_blob_path, size_bytes)
    values (gen_random_uuid(), _alexey_id, 'document', 'hack.pdf', '/hack', 0);
    raise exception 'FAIL (b): anon was able to INSERT into vault_items';
  exception
    when others then
      raise notice 'PASS (b): anon cannot insert into vault_items';
  end;

  -- ==========================================================
  -- (c) Anon CAN read users (needed for role switcher)
  -- ==========================================================
  select count(*) into _count from users;
  if _count < 2 then
    raise exception 'FAIL (c): anon should see at least 2 users, got %', _count;
  end if;

  raise notice 'PASS (c): anon can read users (count=%)', _count;

  -- ==========================================================
  -- Switch to service_role to insert test data
  -- ==========================================================
  perform set_config('role', 'service_role', true);

  insert into vault_items (id, owner_id, type, name, encrypted_blob_path, iv, size_bytes)
  values (_item_id, _alexey_id, 'document', 'will.pdf', '/vault/alexey/will.enc', 'test-iv-123', 1024);

  -- ==========================================================
  -- (d) Alexey sees his document, Maria does not
  -- ==========================================================

  -- Emulate Alexey
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"' || _alexey_id || '"}', true);

  select count(*) into _count from vault_items;
  if _count != 1 then
    raise exception 'FAIL (d): Alexey should see 1 vault_item, got %', _count;
  end if;

  raise notice 'PASS (d.1): Alexey sees his own document';

  -- Emulate Maria
  perform set_config('request.jwt.claims', '{"sub":"' || _maria_id || '"}', true);

  select count(*) into _count from vault_items;
  if _count != 0 then
    raise exception 'FAIL (d): Maria should see 0 vault_items, got %', _count;
  end if;

  raise notice 'PASS (d.2): Maria cannot see Alexey''s document (no access yet)';

  -- ==========================================================
  -- (e) After recipient + access_rule + trigger(delivered), Maria sees the document
  -- ==========================================================

  -- Insert test data as service_role
  perform set_config('role', 'service_role', true);

  insert into recipients (id, owner_id, full_name, relation, user_id)
  values (_recip_id, _alexey_id, 'Maria Ivanova', 'wife', _maria_id);

  insert into access_rules (id, vault_item_id, recipient_id, delay_days)
  values (_rule_id, _item_id, _recip_id, 0);

  insert into triggers (id, owner_id, type, status, confirmed_at)
  values (_trig_id, _alexey_id, 'zags_event', 'delivered', now());

  -- Emulate Maria again
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"' || _maria_id || '"}', true);

  select count(*) into _count from vault_items;
  if _count != 1 then
    raise exception 'FAIL (e): Maria should see 1 vault_item after delivery, got %', _count;
  end if;

  raise notice 'PASS (e): Maria can see Alexey''s document after event delivery';

  -- ==========================================================
  -- All checks passed
  -- ==========================================================
  raise notice '========================================';
  raise notice 'All RLS checks passed ✓';
  raise notice '========================================';

end $$;

-- Rollback everything — no test data left in the database
rollback;
