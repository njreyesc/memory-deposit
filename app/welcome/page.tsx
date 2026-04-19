import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isBreadwinner } from "@/lib/auth/current-role";
import { WelcomeFlow } from "@/components/onboarding/welcome-flow";

export default async function WelcomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!(await isBreadwinner(supabase, user.id))) {
    redirect("/vault");
  }

  const countRes = await supabase
    .from("vault_items")
    .select("id", { head: true, count: "exact" })
    .eq("owner_id", user.id);

  if ((countRes.count ?? 0) > 0) {
    redirect("/vault");
  }

  const userRes = await supabase
    .from("users")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const userRow = userRes.data as { full_name: string | null } | null;
  const firstName = (userRow?.full_name ?? "").split(/\s+/)[0] || "друг";

  return <WelcomeFlow firstName={firstName} userId={user.id} />;
}
