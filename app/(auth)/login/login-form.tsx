"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { DEMO_USERS, type DemoRole } from "@/lib/auth/demo-users";

export function LoginForm() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(role: DemoRole) {
    setLoading(true);
    try {
      const res = await fetch("/api/mock-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Login failed");
      }

      const { access_token, refresh_token } = await res.json();
      const supabase = createClient();
      await supabase.auth.setSession({ access_token, refresh_token });

      router.push("/welcome");
    } catch (err) {
      console.error("Login error:", err);
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        size="lg"
        className="w-full gap-2 text-base font-semibold text-white"
        style={{ backgroundColor: "var(--brand-sber)" }}
        onClick={() => setOpen(true)}
      >
        <Shield className="h-5 w-5" />
        Войти через Сбер ID
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">
              Выберите профиль для демо
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-4">
            {(Object.entries(DEMO_USERS) as [DemoRole, typeof DEMO_USERS.alexey][]).map(
              ([role, user]) => (
                <button
                  key={role}
                  disabled={loading}
                  onClick={() => handleLogin(role)}
                  className="flex flex-col items-center gap-3 rounded-lg border border-border p-4 transition-colors hover:bg-accent disabled:opacity-50"
                >
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold text-white"
                    style={{
                      backgroundColor:
                        role === "alexey" ? "#21A038" : "#4CAF50",
                    }}
                  >
                    <User className="h-7 w-7" />
                  </div>
                  <div className="space-y-1 text-center">
                    <p className="text-sm font-medium">{user.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {user.role === "breadwinner"
                        ? "Кормилец"
                        : "Получатель"}
                    </p>
                  </div>
                </button>
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
