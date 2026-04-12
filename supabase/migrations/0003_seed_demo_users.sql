-- 0003_seed_demo_users.sql
-- Demo characters with hardcoded UUIDs for role-switch and tests
--
-- Alexey Ivanov (breadwinner): 11111111-1111-1111-1111-111111111111
-- Maria Ivanova (recipient):   22222222-2222-2222-2222-222222222222

insert into users (id, role, full_name, email)
values
  ('11111111-1111-1111-1111-111111111111', 'breadwinner', 'Alexey Ivanov',  'alexey@demo.local'),
  ('22222222-2222-2222-2222-222222222222', 'recipient',   'Maria Ivanova',  'maria@demo.local')
on conflict (id) do nothing;
