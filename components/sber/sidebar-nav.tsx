"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeartHandshake, PlayCircle, Users2, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/vault", label: "Забота", icon: HeartHandshake },
  { href: "/finance", label: "Финансовая карта", icon: Wallet },
  { href: "/recipients", label: "Близкие", icon: Users2 },
  {
    href: "/simulate",
    label: "Показать, как это будет работать",
    icon: PlayCircle,
  },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
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
