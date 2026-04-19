"use client";

import { useState } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
  const [switching, setSwitching] = useState(false);

  const isTestMode = Boolean(testSession);

  const currentRole: DemoRole = testSession
    ? currentUserId === testSession.breadwinnerUserId
      ? "alexey"
      : "maria"
    : currentUserId === DEMO_USERS.alexey.id
      ? "alexey"
      : "maria";
  const otherRole: DemoRole = currentRole === "alexey" ? "maria" : "alexey";

  const alexeyLabel = testSession
    ? testSession.breadwinnerName
    : DEMO_USERS.alexey.full_name;
  const mariaLabel = testSession
    ? testSession.recipientName
    : DEMO_USERS.maria.full_name;
  const currentLabel = currentRole === "alexey" ? alexeyLabel : mariaLabel;
  const otherLabel = otherRole === "alexey" ? alexeyLabel : mariaLabel;

  const initialOf = (s: string) => s.trim().charAt(0).toUpperCase() || "?";
  const currentInitial = isTestMode
    ? initialOf(currentLabel)
    : DEMO_USERS[currentRole].avatar_initial;
  const otherInitial = isTestMode
    ? initialOf(otherLabel)
    : DEMO_USERS[otherRole].avatar_initial;

  const otherRoleKind = otherRole === "alexey" ? "breadwinner" : "recipient";

  async function handleSwitch() {
    setSwitching(true);

    if (testSession) {
      try {
        const r = await fetch("/api/mock-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: otherRole,
            sessionToken: testSession.token,
          }),
        });
        if (r.status === 401) {
          window.location.assign("/login");
          return;
        }
        if (!r.ok) {
          console.error("role switch failed", await r.text());
          setSwitching(false);
          return;
        }
        window.location.assign(window.location.pathname);
      } catch (err) {
        console.error("Switch error:", err);
        setSwitching(false);
      }
      return;
    }

    try {
      const res = await fetch("/api/mock-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: otherRole }),
      });

      if (!res.ok) throw new Error("Switch failed");

      const { access_token, refresh_token } = await res.json();
      const supabase = createClient();
      await supabase.auth.setSession({ access_token, refresh_token });

      window.location.reload();
    } catch (err) {
      console.error("Switch error:", err);
      setSwitching(false);
    }
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-white/10 focus:outline-none"
        disabled={switching}
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
          onClick={handleSwitch}
          disabled={switching}
          className="cursor-pointer gap-2"
        >
          <div
            className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{
              backgroundColor: otherRole === "alexey" ? "#21A038" : "#4CAF50",
            }}
          >
            {otherInitial}
          </div>
          <div>
            <p className="text-sm">{otherLabel}</p>
            <p className="text-xs text-muted-foreground">
              {otherRoleKind === "breadwinner" ? "Кормилец" : "Получатель"}
            </p>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={handleLogout}
          className="cursor-pointer gap-2 text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Выйти
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
