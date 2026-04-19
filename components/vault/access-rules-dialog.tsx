"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export interface Recipient {
  id: string;
  full_name: string;
  relation: string;
}

export interface AccessRule {
  id: string;
  vault_item_id: string;
  recipient_id: string;
  delay_days: number;
}

const RELATION_LABELS: Record<string, string> = {
  wife: "жена",
  husband: "муж",
  son: "сын",
  daughter: "дочь",
  brother: "брат",
  sister: "сестра",
  parent: "родитель",
  other: "другое",
};

function daysLabel(n: number): string {
  if (n === 0) return "сразу";
  const mod10 = n % 10;
  const mod100 = n % 100;
  let unit = "дней";
  if (mod10 === 1 && mod100 !== 11) unit = "день";
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) unit = "дня";
  return `через ${n} ${unit}`;
}

export function formatAccessRulesLabel(
  rules: AccessRule[],
  recipients: Recipient[]
): string {
  if (rules.length === 0) return "Близкие не назначены";
  const byId = new Map(recipients.map((r) => [r.id, r]));
  const parts = rules
    .map((rule) => {
      const r = byId.get(rule.recipient_id);
      if (!r) return null;
      return `${r.full_name} (${daysLabel(rule.delay_days)})`;
    })
    .filter((s): s is string => s !== null);
  if (parts.length === 0) return "Близкие не назначены";
  return `Получат: ${parts.join(", ")}`;
}

export function findSpouse(recipients: Recipient[]): Recipient | null {
  return (
    recipients.find(
      (r) => r.relation === "wife" || r.relation === "husband"
    ) ?? null
  );
}

export async function createSpouseDefaultRule(
  vaultItemId: string,
  recipients: Recipient[]
): Promise<AccessRule | null> {
  const spouse = findSpouse(recipients);
  if (!spouse) return null;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("access_rules")
    .insert({
      vault_item_id: vaultItemId,
      recipient_id: spouse.id,
      delay_days: 0,
    })
    .select("id, vault_item_id, recipient_id, delay_days")
    .single();
  if (error || !data) return null;
  return data as AccessRule;
}

interface AccessRulesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vaultItemId: string;
  itemLabel: string;
  recipients: Recipient[];
  currentRules: AccessRule[];
  onSaved: (rules: AccessRule[]) => void;
}

interface RowState {
  checked: boolean;
  delay: string;
}

export function AccessRulesDialog({
  open,
  onOpenChange,
  vaultItemId,
  itemLabel,
  recipients,
  currentRules,
  onSaved,
}: AccessRulesDialogProps) {
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentByRecipient = useMemo(() => {
    const m = new Map<string, AccessRule>();
    for (const rule of currentRules) m.set(rule.recipient_id, rule);
    return m;
  }, [currentRules]);

  useEffect(() => {
    if (!open) return;
    const next: Record<string, RowState> = {};
    for (const r of recipients) {
      const existing = currentByRecipient.get(r.id);
      next[r.id] = existing
        ? { checked: true, delay: String(existing.delay_days) }
        : { checked: false, delay: "0" };
    }
    setRows(next);
    setError(null);
  }, [open, recipients, currentByRecipient]);

  function toggle(recipientId: string, checked: boolean) {
    setRows((prev) => ({
      ...prev,
      [recipientId]: { ...prev[recipientId], checked },
    }));
  }

  function setDelay(recipientId: string, delay: string) {
    setRows((prev) => ({
      ...prev,
      [recipientId]: { ...prev[recipientId], delay },
    }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const toInsert: {
      vault_item_id: string;
      recipient_id: string;
      delay_days: number;
    }[] = [];

    for (const r of recipients) {
      const state = rows[r.id];
      if (!state?.checked) continue;
      const n = Number.parseInt(state.delay, 10);
      if (!Number.isFinite(n) || n < 0 || n > 365) {
        setError(
          `Для получателя «${r.full_name}» задержка должна быть от 0 до 365 дней.`
        );
        setSaving(false);
        return;
      }
      toInsert.push({
        vault_item_id: vaultItemId,
        recipient_id: r.id,
        delay_days: n,
      });
    }

    const supabase = createClient();

    const { error: deleteError } = await supabase
      .from("access_rules")
      .delete()
      .eq("vault_item_id", vaultItemId);
    if (deleteError) {
      setError(`Не удалось обновить правила: ${deleteError.message}`);
      setSaving(false);
      return;
    }

    if (toInsert.length === 0) {
      onSaved([]);
      setSaving(false);
      onOpenChange(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("access_rules")
      .insert(toInsert)
      .select("id, vault_item_id, recipient_id, delay_days");
    if (insertError || !data) {
      setError(`Не удалось сохранить правила: ${insertError?.message ?? ""}`);
      setSaving(false);
      return;
    }

    onSaved(data as AccessRule[]);
    setSaving(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Кому передать</DialogTitle>
          <p className="text-xs text-muted-foreground">{itemLabel}</p>
        </DialogHeader>

        {recipients.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Сначала добавьте близких в разделе «Близкие».
          </p>
        ) : (
          <ul className="space-y-3">
            {recipients.map((r) => {
              const state = rows[r.id] ?? { checked: false, delay: "0" };
              return (
                <li
                  key={r.id}
                  className="flex items-center gap-3 rounded-md border border-white/10 bg-card/50 p-3"
                >
                  <label className="flex flex-1 items-center gap-3">
                    <input
                      type="checkbox"
                      checked={state.checked}
                      onChange={(e) => toggle(r.id, e.target.checked)}
                      disabled={saving}
                      className="h-4 w-4 shrink-0"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {r.full_name}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {RELATION_LABELS[r.relation] ?? r.relation}
                      </span>
                    </span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={365}
                      value={state.delay}
                      onChange={(e) => setDelay(r.id, e.target.value)}
                      disabled={saving || !state.checked}
                      className="h-8 w-20 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                    />
                    <span className="text-xs text-muted-foreground">
                      дней после события
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Отмена
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || recipients.length === 0}
            className="text-white"
            style={{ backgroundColor: "#21A038" }}
          >
            {saving ? "Сохраняем…" : "Сохранить"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
