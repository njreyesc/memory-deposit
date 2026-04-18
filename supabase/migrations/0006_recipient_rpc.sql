-- 0006_recipient_rpc.sql
-- RPC functions для экрана получателя.
-- Получатель не может напрямую читать таблицы triggers / access_rules / recipients
-- (RLS закрыта только для владельца), поэтому достаём данные через
-- SECURITY DEFINER функции, которые опираются на auth.uid().

-- ============================================================
-- recipient_event_status()
-- Возвращает строку для каждого владельца, у которого:
--   1) есть триггер со статусом 'delivered'
--   2) текущий пользователь указан как recipient (recipients.user_id)
-- Используется чтобы понять «событие подтверждено или нет».
-- ============================================================
create or replace function recipient_event_status()
returns table (
  owner_id        uuid,
  owner_full_name text,
  confirmed_at    timestamptz
)
language sql
security definer
stable
as $$
  select distinct on (t.owner_id)
    t.owner_id,
    u.full_name as owner_full_name,
    t.confirmed_at
  from triggers t
  join recipients r on r.owner_id = t.owner_id
  join users u      on u.id = t.owner_id
  where r.user_id = auth.uid()
    and t.status  = 'delivered'
  order by t.owner_id, t.confirmed_at desc nulls last;
$$;

grant execute on function recipient_event_status() to authenticated;

-- ============================================================
-- get_recipient_materials()
-- Возвращает все материалы (заметки + видео), доступные текущему получателю
-- после подтверждённого события, с расчётом задержки.
--   available_at  = confirmed_at + delay_days
--   available_now = now() >= available_at
-- UI решает: показать содержимое или заглушку «будет доступно <дата>».
-- ============================================================
create or replace function get_recipient_materials()
returns table (
  vault_item_id    uuid,
  item_type        text,
  title            text,
  content          text,
  video_path       text,
  item_created_at  timestamptz,
  owner_id         uuid,
  owner_full_name  text,
  delay_days       int,
  confirmed_at     timestamptz,
  available_at     timestamptz,
  available_now    boolean
)
language sql
security definer
stable
as $$
  select
    v.id          as vault_item_id,
    v.type        as item_type,
    v.title,
    v.content,
    v.video_path,
    v.created_at  as item_created_at,
    v.owner_id,
    u.full_name   as owner_full_name,
    ar.delay_days,
    t.confirmed_at,
    (t.confirmed_at + make_interval(days => ar.delay_days)) as available_at,
    (now() >= (t.confirmed_at + make_interval(days => ar.delay_days))) as available_now
  from access_rules ar
  join recipients   r on r.id       = ar.recipient_id
  join vault_items  v on v.id       = ar.vault_item_id
  join users        u on u.id       = v.owner_id
  join triggers     t on t.owner_id = v.owner_id
                      and t.status  = 'delivered'
  where r.user_id = auth.uid()
  order by v.created_at desc;
$$;

grant execute on function get_recipient_materials() to authenticated;
