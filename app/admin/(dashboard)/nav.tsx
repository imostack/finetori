"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import type { UserRole } from "@/db/schema";

type NavItem = {
  href: string;
  label: string;
  minRole: UserRole;
  badgeKey?: "queue";
};

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", minRole: "writer" },
  { href: "/admin/queue", label: "Review queue", minRole: "editor", badgeKey: "queue" },
  { href: "/admin/posts", label: "Articles", minRole: "writer" },
  { href: "/admin/categories", label: "Categories", minRole: "editor" },
  { href: "/admin/sources", label: "News sources", minRole: "admin" },
  { href: "/admin/newsletter", label: "Newsletter", minRole: "editor" },
  { href: "/admin/users", label: "Team", minRole: "admin" },
];

const ROLE_RANK: Record<UserRole, number> = { writer: 1, editor: 2, admin: 3 };

export function AdminNav({
  role,
  queueCount,
}: {
  role: UserRole;
  queueCount: number;
}) {
  const pathname = usePathname();

  return (
    <nav className="space-y-0.5">
      {NAV.filter((item) => ROLE_RANK[role] >= ROLE_RANK[item.minRole]).map(
        (item) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center justify-between rounded-md px-3 py-2 text-sm transition",
                active
                  ? "bg-neutral-900 font-medium text-white"
                  : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
              )}
            >
              <span>{item.label}</span>
              {item.badgeKey === "queue" && queueCount > 0 ? (
                <span
                  className={cn(
                    "ml-2 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                    active ? "bg-white text-neutral-900" : "bg-amber-500 text-white",
                  )}
                >
                  {queueCount}
                </span>
              ) : null}
            </Link>
          );
        },
      )}
    </nav>
  );
}
