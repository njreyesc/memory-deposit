"use client";

import { useState } from "react";
import { ChevronDown, LogOut, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { DEMO_USERS, type DemoRole } from "@/lib/auth/demo-users";

interface RoleSwitcherProps {
  currentUserId: string;
}

export function RoleSwitcher({ currentUserId }: RoleSwitcherProps) {
  const [switching, setSwitching] = useState(false);

  const currentRole: DemoRole =
    currentUserId === DEMO_USERS.alexey.id ? "alexey" : "maria";
  const currentUser = DEMO_USERS[currentRole];
  const otherRole: DemoRole = currentRole === "alexey" ? "maria" : "alexey";
  const otherUser = DEMO_USERS[otherRole];

  async function handleSwitch() {
    setSwitching(true);
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
            backgroundColor:
              currentRole === "alexey" ? "#21A038" : "#4CAF50",
          }}
        >
          {currentUser.avatar_initial}
        </div>
        <span className="text-sm font-medium">{currentUser.full_name}</span>
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
              backgroundColor:
                otherRole === "alexey" ? "#21A038" : "#4CAF50",
            }}
          >
            {otherUser.avatar_initial}
          </div>
          <div>
            <p className="text-sm">{otherUser.full_name}</p>
            <p className="text-xs text-muted-foreground">
              {otherUser.role === "breadwinner" ? "Кормилец" : "Получатель"}
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
