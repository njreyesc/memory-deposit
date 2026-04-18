import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEMO_USERS } from "@/lib/auth/demo-users";
import { RoleSwitcher } from "@/components/sber/role-switcher";
import { SidebarNav } from "@/components/sber/sidebar-nav";

export default async function AdminLayout({
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

  if (user.id !== DEMO_USERS.alexey.id) {
    redirect("/vault");
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 flex-col border-r border-white/10 p-4">
        <div className="mb-8">
          <h2 className="text-lg font-bold tracking-tight">Депозит памяти</h2>
          <p className="text-xs text-muted-foreground">v0.1 prototype</p>
        </div>
        <SidebarNav isBreadwinner={true} />
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-end border-b border-white/10 px-6 py-3">
          <RoleSwitcher currentUserId={user.id} />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
