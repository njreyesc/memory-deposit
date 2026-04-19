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
}

export function RoleSwitcher({
  currentUserId,
  testSession,
}: RoleSwitcherProps) {
  const [loggingOut, setLoggingOut] = useState(false);

  const isTestMode = Boolean(testSession);

  const currentRole: DemoRole = testSession
    ? currentUserId === testSession.breadwinnerUserId
      ? "alexey"
      : "maria"
    : currentUserId === DEMO_USERS.alexey.id
      ? "alexey"
      : "maria";

  const currentLabel = isTestMode
    ? currentRole === "alexey"
      ? testSession!.breadwinnerName
      : testSession!.recipientName
    : DEMO_USERS[currentRole].full_name;

  const initialOf = (s: string) => s.trim().charAt(0).toUpperCase() || "?";
  const currentInitial = isTestMode
    ? initialOf(currentLabel)
    : DEMO_USERS[currentRole].avatar_initial;

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
            backgroundColor: currentRole === "alexey" ? "#21A038" : "#4CAF50",
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
