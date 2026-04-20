import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isBreadwinner } from "@/lib/auth/current-role";
import {
  FinanceMap,
  type FinanceRecipient,
} from "@/components/finance/finance-map";
import { SceneTracker } from "@/components/telemetry/scene-tracker";

export default async function FinancePage() {
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
        <h1 className="text-2xl font-bold">Финансовая карта</h1>
        <div className="mt-6 rounded-lg border border-dashed border-white/10 p-10 text-center text-sm text-muted-foreground">
          Этот раздел доступен только владельцу аккаунта.
        </div>
      </div>
    );
  }

  const { data: recipientsData } = await supabase
    .from("recipients")
    .select("id, full_name, relation")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true });

  const recipients = (recipientsData ?? []) as FinanceRecipient[];

  return (
    <>
      <SceneTracker scene="finance" />
      <FinanceMap userId={user.id} recipients={recipients} />
    </>
  );
}
