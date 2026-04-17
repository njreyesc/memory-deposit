import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEMO_USERS } from "@/lib/auth/demo-users";
import { NotesSection, type Note } from "@/components/vault/notes-section";

export default async function VaultPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const isAlexey = user.id === DEMO_USERS.alexey.id;

  if (!isAlexey) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Хранилище</h1>
        <div className="mt-6 rounded-lg border border-dashed border-white/10 p-10 text-center text-sm text-muted-foreground">
          Материалы будут доступны после подтверждения события.
        </div>
      </div>
    );
  }

  const { data, error } = await supabase
    .from("vault_items")
    .select("id, title, content, created_at")
    .eq("owner_id", user.id)
    .eq("type", "note")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Хранилище</h1>
        <p className="text-sm text-destructive">
          Не удалось загрузить письма: {error.message}
        </p>
      </div>
    );
  }

  const notes = (data ?? []) as Note[];

  return <NotesSection ownerId={user.id} initialNotes={notes} />;
}
