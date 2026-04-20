import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isBreadwinner } from "@/lib/auth/current-role";
import { resolveTestSession } from "@/lib/auth/test-session";
import { RoleSwitcher } from "@/components/sber/role-switcher";
import { SidebarNav } from "@/components/sber/sidebar-nav";
import { AssistantWidget } from "@/components/assistant/assistant-widget";

interface RecipientEventRow {
  owner_id: string;
  owner_full_name: string;
  confirmed_at: string;
}

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

  const isBreadwinnerUser = await isBreadwinner(supabase, user.id);

  let silentRecipientMode = false;
  if (!isBreadwinnerUser) {
    const eventRes = await supabase.rpc("recipient_event_status");
    const eventRows = (eventRes.data ?? []) as RecipientEventRow[];
    silentRecipientMode = eventRows.length > 0;
  }

  // Update last_seen_at (fire-and-forget)
  supabase
    .from("users")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", user.id)
    .then();

  const testSession = await resolveTestSession(user.id);

  if (silentRecipientMode) {
    return (
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-end px-6 py-3">
          <RoleSwitcher currentUserId={user.id} testSession={testSession} />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col border-r border-white/10 p-4">
        <div className="mb-8">
          <h2 className="text-lg font-bold tracking-tight">Депозит памяти</h2>
          <p className="text-xs text-muted-foreground">для тех, кто рядом</p>
        </div>
        <SidebarNav />
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

      <AssistantWidget userId={user.id} />
    </div>
  );
}
