import { NextResponse } from "next/server";
import { z } from "zod";
import { cleanupSession } from "@/lib/test-sessions/cleanup";

export const runtime = "nodejs";

const bodySchema = z.object({
  sessionToken: z.string().min(1),
});

export async function POST(request: Request) {
  let sessionToken: string;
  try {
    const raw = (await request.json()) as unknown;
    ({ sessionToken } = bodySchema.parse(raw));
  } catch {
    return NextResponse.json(
      { error: "sessionToken is required" },
      { status: 400 }
    );
  }

  try {
    const result = await cleanupSession(sessionToken);
    if (!result.found) {
      return NextResponse.json(
        { error: "session not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true, removed: result.removed });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown";
    return NextResponse.json(
      { error: "cleanup failed", detail },
      { status: 500 }
    );
  }
}
