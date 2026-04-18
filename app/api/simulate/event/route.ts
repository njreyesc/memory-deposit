import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function makeRequestId(): string {
  // 11-digit numeric id; not cryptographically meaningful — demo only.
  return Array.from({ length: 11 }, () =>
    Math.floor(Math.random() * 10).toString()
  ).join("");
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestId = makeRequestId();

  const { data: trigger, error: triggerError } = await supabase
    .from("triggers")
    .insert({
      owner_id: user.id,
      type: "zags_event",
      status: "delivered",
      confirmed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (triggerError || !trigger) {
    return NextResponse.json(
      { error: triggerError?.message ?? "trigger insert failed" },
      { status: 500 }
    );
  }

  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "simulate_zags_event",
    meta: { request_id: requestId, trigger_id: trigger.id },
  });

  return NextResponse.json({
    ok: true,
    request_id: requestId,
    trigger_id: trigger.id,
  });
}
