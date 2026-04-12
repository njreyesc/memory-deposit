-- 0002_rls_policies.sql
-- Enable RLS on all tables and create access policies
-- Uses SECURITY DEFINER functions to avoid circular RLS recursion
-- between vault_items <-> access_rules

-- ============================================================
-- Enable RLS
-- ============================================================
alter table users        enable row level security;
alter table vault_items  enable row level security;
alter table recipients   enable row level security;
alter table access_rules enable row level security;
alter table triggers     enable row level security;
alter table audit_log    enable row level security;

-- ============================================================
-- Helper functions (SECURITY DEFINER — bypass RLS in subqueries)
-- ============================================================

-- Check if a recipient has access to a vault item (after event delivery)
create or replace function check_vault_item_access(_item_id uuid, _user_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from access_rules ar
    join recipients r on r.id = ar.recipient_id
    join triggers t  on t.owner_id = (select owner_id from vault_items where id = _item_id)
    where ar.vault_item_id = _item_id
      and r.user_id = _user_id
      and t.status = 'delivered'
  );
$$;

-- Check if the user owns the vault_item linked to an access_rule
create or replace function check_access_rule_ownership(_vault_item_id uuid, _user_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from vault_items
    where id = _vault_item_id
      and owner_id = _user_id
  );
$$;

-- ============================================================
-- users
-- SELECT: everyone (needed for demo role switcher)
-- UPDATE: only own record
-- ============================================================
create policy "users_select_all"
  on users for select
  using (true);

create policy "users_update_own"
  on users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ============================================================
-- vault_items
-- Owner sees everything, recipient sees item only when:
--   1. There is an access_rule linking the item to a recipient
--   2. That recipient.user_id = current user
--   3. The owner has a trigger with status = 'delivered'
-- INSERT/UPDATE/DELETE: owner only
-- ============================================================
create policy "vault_items_select"
  on vault_items for select
  using (
    owner_id = auth.uid()
    or check_vault_item_access(id, auth.uid())
  );

create policy "vault_items_insert"
  on vault_items for insert
  with check (owner_id = auth.uid());

create policy "vault_items_update"
  on vault_items for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "vault_items_delete"
  on vault_items for delete
  using (owner_id = auth.uid());

-- ============================================================
-- recipients
-- Full CRUD only for owner
-- ============================================================
create policy "recipients_select"
  on recipients for select
  using (owner_id = auth.uid());

create policy "recipients_insert"
  on recipients for insert
  with check (owner_id = auth.uid());

create policy "recipients_update"
  on recipients for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "recipients_delete"
  on recipients for delete
  using (owner_id = auth.uid());

-- ============================================================
-- access_rules
-- Access through vault_items ownership (via SECURITY DEFINER)
-- ============================================================
create policy "access_rules_select"
  on access_rules for select
  using (check_access_rule_ownership(vault_item_id, auth.uid()));

create policy "access_rules_insert"
  on access_rules for insert
  with check (check_access_rule_ownership(vault_item_id, auth.uid()));

create policy "access_rules_update"
  on access_rules for update
  using (check_access_rule_ownership(vault_item_id, auth.uid()));

create policy "access_rules_delete"
  on access_rules for delete
  using (check_access_rule_ownership(vault_item_id, auth.uid()));

-- ============================================================
-- triggers
-- Only owner
-- ============================================================
create policy "triggers_select"
  on triggers for select
  using (owner_id = auth.uid());

create policy "triggers_insert"
  on triggers for insert
  with check (owner_id = auth.uid());

create policy "triggers_update"
  on triggers for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "triggers_delete"
  on triggers for delete
  using (owner_id = auth.uid());

-- ============================================================
-- audit_log
-- INSERT: any authenticated user
-- SELECT: only own entries
-- ============================================================
create policy "audit_log_insert"
  on audit_log for insert
  with check (auth.role() = 'authenticated');

create policy "audit_log_select"
  on audit_log for select
  using (actor_id = auth.uid());
