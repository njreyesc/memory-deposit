-- 0001_initial_schema.sql
-- Creates all tables for Memory Deposit prototype

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- users
-- ============================================================
create table users (
  id          uuid primary key default gen_random_uuid(),
  role        text not null check (role in ('breadwinner', 'recipient')),
  full_name   text not null,
  email       text not null unique,
  last_seen_at timestamptz,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- vault_items
-- ============================================================
create table vault_items (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references users(id) on delete cascade,
  type                text not null check (type in ('document', 'video')),
  name                text not null,
  encrypted_blob_path text not null,
  iv                  text,          -- null for video (not encrypted in prototype)
  size_bytes          bigint not null default 0,
  created_at          timestamptz not null default now()
);

create index idx_vault_items_owner on vault_items(owner_id);

-- ============================================================
-- recipients
-- ============================================================
create table recipients (
  id        uuid primary key default gen_random_uuid(),
  owner_id  uuid not null references users(id) on delete cascade,
  full_name text not null,
  relation  text not null,
  user_id   uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_recipients_owner on recipients(owner_id);

-- ============================================================
-- access_rules
-- ============================================================
create table access_rules (
  id            uuid primary key default gen_random_uuid(),
  vault_item_id uuid not null references vault_items(id) on delete cascade,
  recipient_id  uuid not null references recipients(id) on delete cascade,
  delay_days    int not null default 0,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- triggers
-- ============================================================
create table triggers (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references users(id) on delete cascade,
  type         text not null check (type in ('zags_event', 'dead_man_switch')),
  status       text not null default 'pending' check (status in ('pending', 'confirmed', 'delivered')),
  confirmed_at timestamptz,
  created_at   timestamptz not null default now()
);

create index idx_triggers_owner on triggers(owner_id);

-- ============================================================
-- audit_log
-- ============================================================
create table audit_log (
  id        uuid primary key default gen_random_uuid(),
  actor_id  uuid references users(id) on delete set null,
  action    text not null,
  meta      jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index idx_audit_log_actor on audit_log(actor_id);
