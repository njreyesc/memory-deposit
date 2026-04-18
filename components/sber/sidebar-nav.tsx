"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FlaskConical, FolderLock, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/vault", label: "Хранилище", icon: FolderLock },
  { href: "/recipients", label: "Получатели", icon: Users },
];

const ADMIN_NAV_ITEMS = [
  { href: "/simulate", label: "Демо", icon: FlaskConical },
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
