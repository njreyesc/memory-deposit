import { createClient } from "@supabase/supabase-js";

if (typeof window !== "undefined") {
  throw new Error(
    "lib/supabase/admin.ts must only be used on the server. " +
      "Do not import this in client components."
  );
}

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
