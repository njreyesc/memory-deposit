import { createAdminClient } from "@/lib/supabase/admin";

const VIDEO_BUCKET = "videos";

export interface CleanupResult {
  found: boolean;
  removed: {
    auth_users: number;
    db_rows: number;
    storage_files: number;
  };
}

interface SessionRow {
  id: string;
  breadwinner_user_id: string;
  recipient_user_id: string;
}

interface VaultPathRow {
  video_path: string | null;
  encrypted_blob_path: string | null;
}

// Supabase-js does not expose transactions via the client, so cleanup proceeds
// step-by-step. Order is chosen so a partial failure can be finished by a retry:
// storage paths are collected before any DELETE, and test_sessions is removed
// last — CASCADE on users.test_session_id takes care of both users rows
// (test_sessions.breadwinner_user_id / recipient_user_id use NO ACTION, so
// deleting users rows directly would be blocked by those FKs).
export async function cleanupSession(
  sessionToken: string
): Promise<CleanupResult> {
  const admin = createAdminClient();

  const sessionQuery = await admin
    .from("test_sessions")
    .select("id, breadwinner_user_id, recipient_user_id")
    .eq("session_token", sessionToken)
    .maybeSingle();

  if (sessionQuery.error) {
    throw new Error(`select test_sessions: ${sessionQuery.error.message}`);
  }

  const session = sessionQuery.data as SessionRow | null;
  if (!session) {
    return {
      found: false,
      removed: { auth_users: 0, db_rows: 0, storage_files: 0 },
    };
  }

  const ownerIds = [session.breadwinner_user_id, session.recipient_user_id];

  const pathQuery = await admin
    .from("vault_items")
    .select("video_path, encrypted_blob_path")
    .in("owner_id", ownerIds);

  if (pathQuery.error) {
    throw new Error(`select vault_items paths: ${pathQuery.error.message}`);
  }

  const rows = (pathQuery.data ?? []) as VaultPathRow[];
  const pathsSet = new Set<string>();
  for (const row of rows) {
    if (row.video_path) pathsSet.add(row.video_path);
    if (row.encrypted_blob_path) pathsSet.add(row.encrypted_blob_path);
  }
  const paths = Array.from(pathsSet);

  let storageRemoved = 0;
  if (paths.length > 0) {
    const { data, error } = await admin.storage
      .from(VIDEO_BUCKET)
      .remove(paths);
    if (error) {
      console.error(
        `cleanupSession: storage.remove(${VIDEO_BUCKET}) failed: ${error.message}`
      );
    }
    storageRemoved = data?.length ?? 0;
  }

  let dbRows = 0;

  // access_rules cascades from vault_items.vault_item_id and recipients.recipient_id
  // (both ON DELETE CASCADE in 0001), so no explicit delete is needed for them.
  const triggersDel = await admin
    .from("triggers")
    .delete()
    .in("owner_id", ownerIds)
    .select("id");
  if (triggersDel.error) {
    throw new Error(`delete triggers: ${triggersDel.error.message}`);
  }
  dbRows += triggersDel.data?.length ?? 0;

  const recipientsDel = await admin
    .from("recipients")
    .delete()
    .in("owner_id", ownerIds)
    .select("id");
  if (recipientsDel.error) {
    throw new Error(`delete recipients: ${recipientsDel.error.message}`);
  }
  dbRows += recipientsDel.data?.length ?? 0;

  const vaultDel = await admin
    .from("vault_items")
    .delete()
    .in("owner_id", ownerIds)
    .select("id");
  if (vaultDel.error) {
    throw new Error(`delete vault_items: ${vaultDel.error.message}`);
  }
  dbRows += vaultDel.data?.length ?? 0;

  const sessionDel = await admin
    .from("test_sessions")
    .delete()
    .eq("id", session.id)
    .select("id");
  if (sessionDel.error) {
    throw new Error(`delete test_sessions: ${sessionDel.error.message}`);
  }
  if ((sessionDel.data?.length ?? 0) > 0) {
    dbRows += 2;
  }

  let authRemoved = 0;
  for (const userId of ownerIds) {
    try {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) {
        const msg = error.message.toLowerCase();
        if (!msg.includes("not found")) {
          console.error(
            `cleanupSession: auth.admin.deleteUser(${userId}) failed: ${error.message}`
          );
        }
      } else {
        authRemoved += 1;
      }
    } catch (err) {
      console.error(
        `cleanupSession: auth.admin.deleteUser(${userId}) threw: ${
          err instanceof Error ? err.message : "unknown"
        }`
      );
    }
  }

  return {
    found: true,
    removed: {
      auth_users: authRemoved,
      db_rows: dbRows,
      storage_files: storageRemoved,
    },
  };
}
