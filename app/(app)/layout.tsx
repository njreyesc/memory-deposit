import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEMO_USERS } from "@/lib/auth/demo-users";
import {
  RoleSwitcher,
  type TestSessionInfo,
} from "@/components/sber/role-switcher";
import { SidebarNav } from "@/components/sber/sidebar-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const isBreadwinner = user.id === DEMO_USERS.alexey.id;

  // Update last_seen_at (fire-and-forget)
  supabase
    .from("users")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", user.id)
    .then();

  // Test-session lookup for role-switcher labeling. Service-role client is
  // required — RLS on test_sessions allows only service_role (see 0007).
  // Failures collapse to undefined, which makes the switcher fall back to
  // DEMO_USERS labels; we don't throw on a stale/cleaned-up/expired cookie.
  const cookieStore = await cookies();
  const testSessionToken = cookieStore.get("test_session_token")?.value;
  let testSession: TestSessionInfo | undefined;
  if (testSessionToken) {
    const admin = createAdminClient();
    const { data: sess } = await admin
      .from("test_sessions")
      .select("breadwinner_user_id, recipient_user_id, cleaned_up, expires_at")
      .eq("session_token", testSessionToken)
      .maybeSingle();

    if (
      sess &&
      sess.cleaned_up !== true &&
      new Date(sess.expires_at) > new Date() &&
      (user.id === sess.breadwinner_user_id ||
        user.id === sess.recipient_user_id)
    ) {
      const { data: testUsers } = await admin
        .from("users")
        .select("id, full_name")
        .in("id", [sess.breadwinner_user_id, sess.recipient_user_id]);

      const b = testUsers?.find((u) => u.id === sess.breadwinner_user_id);
      const m = testUsers?.find((u) => u.id === sess.recipient_user_id);
      if (b && m) {
        testSession = {
          token: testSessionToken,
          breadwinnerUserId: sess.breadwinner_user_id,
          recipientUserId: sess.recipient_user_id,
          breadwinnerName: b.full_name,
          recipientName: m.full_name,
        };
      }
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col border-r border-white/10 p-4">
        <div className="mb-8">
          <h2 className="text-lg font-bold tracking-tight">Депозит памяти</h2>
          <p className="text-xs text-muted-foreground">v0.1 prototype</p>
        </div>
        <SidebarNav isBreadwinner={isBreadwinner} />
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col">
        {/* Top bar */}
        <header className="flex items-center justify-end border-b border-white/10 px-6 py-3">
          <RoleSwitcher currentUserId={user.id} testSession={testSession} />
        </header>

        {/* Content */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
