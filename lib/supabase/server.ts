import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// TODO: replace with generated types after schema stabilizes
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Database = any;

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignored in Server Components where cookies are read-only.
            // Middleware handles the refresh.
          }
        },
      },
    }
  );
}
