# Supabase Setup — Memory Deposit

## Applying Migrations

Open **Supabase Dashboard > SQL Editor** and execute these files **in order** (copy-paste each one):

1. `supabase/migrations/0001_initial_schema.sql` — tables, indexes, constraints
2. `supabase/migrations/0002_rls_policies.sql` — RLS enable + all policies
3. `supabase/migrations/0003_seed_demo_users.sql` — Alexey & Maria demo users

## Creating Storage Bucket

1. Go to **Storage > New bucket**
2. Name: `vault`
3. **Private** (not public)
4. File size limit: **50 MB**

Then go to **Storage > Policies** for the `vault` bucket and add these policies via SQL Editor:

```sql
-- Owner can upload files (path starts with their user id)
create policy "vault_storage_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'vault'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner can read their own files
create policy "vault_storage_select"
  on storage.objects for select
  using (
    bucket_id = 'vault'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1
        from vault_items vi
        join access_rules ar on ar.vault_item_id = vi.id
        join recipients r   on r.id = ar.recipient_id
        join triggers t     on t.owner_id = vi.owner_id
        where vi.encrypted_blob_path = name
          and r.user_id = auth.uid()
          and t.status = 'delivered'
      )
    )
  );

-- Owner can delete their own files
create policy "vault_storage_delete"
  on storage.objects for delete
  using (
    bucket_id = 'vault'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
```

## Creating Storage Bucket `videos`

Separate bucket for video messages. Video is NOT encrypted in the prototype
(see CLAUDE.md — architectural decision, not a security gap).

1. Go to **Storage > New bucket**
2. Name: `videos`
3. **Private** (not public)
4. File size limit: **20 MB**

Then add these policies via **SQL Editor**. Owner is identified by the first
folder segment of the object path (`{owner_id}/main.webm`):

```sql
-- Owner can upload their own video (path starts with their user id)
create policy "videos_storage_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'videos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner can read their own video
-- (recipient access will be added at Step 9 together with event delivery.)
create policy "videos_storage_select"
  on storage.objects for select
  using (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner can overwrite their own video (re-record)
create policy "videos_storage_update"
  on storage.objects for update
  using (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner can delete their own video
create policy "videos_storage_delete"
  on storage.objects for delete
  using (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
```

## Visual Check (2 min)

- [ ] 6 tables visible in **Table Editor**: users, vault_items, recipients, access_rules, triggers, audit_log
- [ ] Each table has the RLS icon (green lock)
- [ ] In **Authentication > Policies** each table has its policies listed
- [ ] Bucket `vault` exists and is **Private**
- [ ] Bucket `videos` exists, is **Private**, 20 MB limit, 4 policies attached
- [ ] `users` table has 2 rows with expected UUIDs:
  - `11111111-1111-1111-1111-111111111111` — Alexey Ivanov
  - `22222222-2222-2222-2222-222222222222` — Maria Ivanova

## Automated RLS Check (3 min)

1. Open **SQL Editor**
2. Paste the entire contents of `supabase/tests/rls_check.sql`
3. Run it
4. Expected result: `All RLS checks passed`
5. If any check fails — read the RAISE EXCEPTION message, fix the relevant policy, re-run

The script uses `BEGIN/ROLLBACK` so no test data is left in the database.

## Storage Verification

1. Upload any test file to the `vault` bucket via Dashboard
2. Copy its public URL
3. Open in incognito/private browser window
4. Expected: **401 or 403** (not 200) — confirms the bucket is private
