import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEMO_USERS } from "@/lib/auth/demo-users";

export default async function VaultPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const isAlexey = user.id === DEMO_USERS.alexey.id;

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold">Хранилище</h1>
      <p className="text-muted-foreground">
        {isAlexey
          ? "Здесь будут ваши документы"
          : "Материалы от Алексея"}
      </p>
    </div>
  );
}
