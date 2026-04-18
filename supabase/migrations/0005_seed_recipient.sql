-- 0005_seed_recipient.sql
-- Seed Maria as a recipient of Alexey.
--
-- Recipient row UUID (stable for future migrations / access_rules):
--   33333333-3333-3333-3333-333333333333
-- Owner (Alexey):     11111111-1111-1111-1111-111111111111
-- Linked user (Maria): 22222222-2222-2222-2222-222222222222

insert into recipients (id, owner_id, full_name, relation, user_id)
values (
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  'Мария Иванова',
  'wife',
  '22222222-2222-2222-2222-222222222222'
)
on conflict (id) do nothing;
