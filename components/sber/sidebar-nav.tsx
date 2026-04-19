"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FlaskConical, HeartHandshake, Users2 } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/vault", label: "Забота", icon: HeartHandshake },
  { href: "/recipients", label: "Близкие", icon: Users2 },
];

const ADMIN_NAV_ITEMS = [
  { href: "/simulate", label: "Демо-режим", icon: FlaskConical },
];

interface SidebarNavProps {
  isBreadwinner?: boolean;
}

export function SidebarNav({ isBreadwinner = false }: SidebarNavProps) {
  const pathname = usePathname();
  const items = isBreadwinner ? [...NAV_ITEMS, ...ADMIN_NAV_ITEMS] : NAV_ITEMS;

  return (
    <nav className="flex flex-col gap-1">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-white/10 text-foreground"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
