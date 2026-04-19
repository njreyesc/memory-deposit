import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isBreadwinner } from "@/lib/auth/current-role";
import {
  RecipientsSection,
  type Recipient,
} from "@/components/recipients/recipients-section";

export default async function RecipientsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!(await isBreadwinner(supabase, user.id))) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Близкие</h1>
        <div className="mt-6 rounded-lg border border-dashed border-white/10 p-10 text-center text-sm text-muted-foreground">
          Этот раздел доступен только владельцу аккаунта.
        </div>
      </div>
    );
  }

  const { data, error } = await supabase
    .from("recipients")
    .select("id, full_name, relation, user_id, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Близкие</h1>
        <p className="text-sm text-destructive">
          Не удалось загрузить получателей: {error.message}
        </p>
      </div>
    );
  }

  const recipients = (data ?? []) as Recipient[];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Близкие</h1>
        <p className="text-sm text-muted-foreground">
          Кому передать материалы из хранилища после подтверждения события
        </p>
      </div>
      <RecipientsSection ownerId={user.id} initialRecipients={recipients} />
    </div>
  );
}
