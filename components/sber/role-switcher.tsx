"use client";

import { useState } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { DEMO_USERS, type DemoRole } from "@/lib/auth/demo-users";

export type TestSessionInfo = {
  token: string;
  breadwinnerUserId: string;
  recipientUserId: string;
  breadwinnerName: string;
  recipientName: string;
};

interface RoleSwitcherProps {
  currentUserId: string;
  testSession?: TestSessionInfo;
  /**
   * Real signed-in user's name and role, from public.users.
   * Used when the account is neither a demo seed user nor a test session —
   * without it every real account fell through to the "maria" branch below
   * and was labelled "Maria Ivanova".
   */
  currentUserName?: string | null;
  currentUserRole?: "breadwinner" | "recipient" | null;
}

export function RoleSwitcher({
  currentUserId,
  testSession,
  currentUserName,
  currentUserRole,
}: RoleSwitcherProps) {
  const [loggingOut, setLoggingOut] = useState(false);

  const initialOf = (s: string) => s.trim().charAt(0).toUpperCase() || "?";

  // Which fixture, if any, this account belongs to. Both must be matched
  // explicitly — anything unmatched is a real user, not "the other demo one".
  const testRole: DemoRole | null = testSession
    ? currentUserId === testSession.breadwinnerUserId
      ? "alexey"
      : "maria"
    : null;

  const demoRole: DemoRole | null =
    currentUserId === DEMO_USERS.alexey.id
      ? "alexey"
      : currentUserId === DEMO_USERS.maria.id
        ? "maria"
        : null;

  let currentLabel: string;
  let currentInitial: string;
  let isOwner: boolean;

  if (testSession && testRole) {
    currentLabel =
      testRole === "alexey"
        ? testSession.breadwinnerName
        : testSession.recipientName;
    currentInitial = initialOf(currentLabel);
    isOwner = testRole === "alexey";
  } else if (demoRole) {
    currentLabel = DEMO_USERS[demoRole].full_name;
    currentInitial = DEMO_USERS[demoRole].avatar_initial;
    isOwner = demoRole === "alexey";
  } else {
    currentLabel = currentUserName?.trim() || "Профиль";
    currentInitial = initialOf(currentLabel);
    isOwner = currentUserRole === "breadwinner";
  }

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-white/10 focus:outline-none"
        disabled={loggingOut}
      >
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{
            backgroundColor: isOwner ? "#21A038" : "#4CAF50",
          }}
        >
          {currentInitial}
        </div>
        <span className="text-sm font-medium">{currentLabel}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem
          onClick={handleLogout}
          disabled={loggingOut}
          className="cursor-pointer gap-2 text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Выйти
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
