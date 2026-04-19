import type { SupabaseClient } from "@supabase/supabase-js";

export type UserRole = "breadwinner" | "recipient";

/**
 * Resolves the current user's role from public.users.
 * Works for both demo seed users and test-session users — neither
 * stores role in auth.user_metadata, so public.users is the source.
 */
export async function getCurrentRole(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string
): Promise<UserRole | null> {
  const { data } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  const role = (data as { role?: string } | null)?.role;
  return role === "breadwinner" || role === "recipient" ? role : null;
}

export async function isBreadwinner(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string
): Promise<boolean> {
  return (await getCurrentRole(supabase, userId)) === "breadwinner";
}
