"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import TestLoginForm from "./test-login-form";

export function LoginHero() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative min-h-screen">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-10 px-6 py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16 lg:px-12">
        <div className="space-y-6">
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Спокойно. Никуда не торопимся.
          </p>
          <div className="space-y-3">
            <h1
              className="font-heading text-4xl font-medium leading-[1.05] tracking-tight sm:text-[3.25rem]"
              style={{
                fontFamily: "var(--font-source-serif-4), Georgia, serif",
              }}
            >
              Депозит памяти
            </h1>
            <p
              className="text-lg leading-snug sm:text-xl"
              style={{
                fontFamily: "var(--font-source-serif-4), Georgia, serif",
              }}
            >
              <span className="text-muted-foreground">Важное — </span>
              <em
                className="font-normal italic"
                style={{ color: "var(--primary)" }}
              >
                тем, кто дорог
              </em>
              <span className="text-muted-foreground">.</span>
            </p>
          </div>
          <p className="max-w-md text-base leading-relaxed text-muted-foreground">
            Тихое место, где важное собрано в одном месте — чтобы семья всегда
            знала, где что лежит.
          </p>
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition hover:opacity-90"
            >
              Начать
              <ArrowRight className="h-4 w-4" />
            </button>
            <p className="text-sm text-muted-foreground">
              Начните с одного письма. Остальное — когда захотите.
            </p>
          </div>
        </div>

        <div className="hidden items-center justify-center lg:flex">
          <HouseScene />
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Депозит памяти</DialogTitle>
            <p className="text-center text-sm text-muted-foreground">
              Цифровой сейф для вашей семьи
            </p>
          </DialogHeader>
          <div className="pt-2">
            <TestLoginForm />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HouseScene() {
  const line = "#2a2420";
  const roof = "#e7dcc9";
  const wall = "#faf3e8";
  const door = "var(--primary)";
  const leaves = "#c9d4b6";
  const leafStroke = "#8a8257";
  const sun = "#d87d44";
  const adult = "#c7894a";
  const child = "#6b635a";

  return (
    <svg
      viewBox="0 0 440 380"
      role="img"
      aria-label="Семья у дома"
      className="h-auto w-full max-w-lg"
      fill="none"
    >
      {/* sun */}
      <g
        stroke={sun}
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      >
        <circle cx="370" cy="60" r="18" />
        <line x1="370" y1="22" x2="370" y2="30" />
        <line x1="370" y1="90" x2="370" y2="98" />
        <line x1="332" y1="60" x2="340" y2="60" />
        <line x1="400" y1="60" x2="408" y2="60" />
        <line x1="343" y1="33" x2="349" y2="39" />
        <line x1="391" y1="81" x2="397" y2="87" />
        <line x1="343" y1="87" x2="349" y2="81" />
        <line x1="391" y1="39" x2="397" y2="33" />
      </g>

      {/* tree */}
      <g>
        <line
          x1="390"
          y1="340"
          x2="390"
          y2="268"
          stroke={leafStroke}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <circle
          cx="390"
          cy="258"
          r="32"
          fill={leaves}
          stroke={leafStroke}
          strokeWidth="1.6"
        />
      </g>

      {/* ground line */}
      <line
        x1="20"
        y1="340"
        x2="420"
        y2="340"
        stroke={line}
        strokeWidth="1.2"
        strokeLinecap="round"
      />

      {/* house */}
      <g stroke={line} strokeWidth="1.8" strokeLinejoin="round">
        {/* body */}
        <rect x="170" y="200" width="180" height="140" fill={wall} />
        {/* roof */}
        <path d="M158 200 L260 120 L362 200 Z" fill={roof} />
        {/* roof lines for texture */}
        <line
          x1="168"
          y1="200"
          x2="260"
          y2="134"
          stroke={leafStroke}
          strokeWidth="1"
        />
        <line
          x1="260"
          y1="134"
          x2="352"
          y2="200"
          stroke={leafStroke}
          strokeWidth="1"
        />
        {/* door */}
        <rect
          x="240"
          y="260"
          width="50"
          height="80"
          fill={door as string}
          stroke={line}
        />
        <circle cx="280" cy="302" r="1.8" fill={line} />
        {/* windows */}
        <rect x="188" y="222" width="30" height="30" fill="none" />
        <line x1="203" y1="222" x2="203" y2="252" strokeWidth="1" />
        <line x1="188" y1="237" x2="218" y2="237" strokeWidth="1" />
        <rect x="302" y="222" width="30" height="30" fill="none" />
        <line x1="317" y1="222" x2="317" y2="252" strokeWidth="1" />
        <line x1="302" y1="237" x2="332" y2="237" strokeWidth="1" />
      </g>

      {/* two figures */}
      <g>
        {/* adult */}
        <circle cx="110" cy="290" r="10" fill={adult} />
        <path
          d="M99 304 Q99 320 104 340 L116 340 Q121 320 121 304 Z"
          fill={adult}
        />
        {/* child */}
        <circle cx="135" cy="305" r="7" fill={child} />
        <path
          d="M128 315 Q128 326 131 340 L139 340 Q142 326 142 315 Z"
          fill={child}
        />
      </g>
    </svg>
  );
}
