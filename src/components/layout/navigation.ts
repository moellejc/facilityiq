import {
  Building2,
  ClipboardList,
  Gauge,
  LayoutDashboard,
  LineChart,
  Settings,
  Shield,
  Sparkles,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { canAccessAdmin, type Role } from "@/lib/permissions";

export type NavChild = { title: string; href: string };

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  children?: NavChild[];
};

export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  {
    title: "Facilities",
    href: "/facilities",
    icon: Building2,
    children: [
      { title: "Overview", href: "/facilities" },
      { title: "3D Digital Twin", href: "/facilities/twin" },
      { title: "Areas", href: "/facilities/areas" },
      { title: "Assets", href: "/facilities/assets" },
      { title: "Layouts", href: "/facilities/layouts" },
    ],
  },
  {
    title: "Operations",
    href: "/operations/throughput",
    icon: Gauge,
    children: [
      { title: "Throughput", href: "/operations/throughput" },
      { title: "Utilization", href: "/operations/utilization" },
      { title: "Bottlenecks", href: "/operations/bottlenecks" },
    ],
  },
  {
    title: "Finance",
    href: "/finance/operating-costs",
    icon: Wallet,
    children: [
      { title: "Operating Costs", href: "/finance/operating-costs" },
      { title: "Cost per Order", href: "/finance/cost-per-order" },
      { title: "Asset Costs", href: "/finance/asset-costs" },
    ],
  },
  { title: "Scenarios", href: "/scenarios", icon: LineChart },
  { title: "AI Insights", href: "/insights", icon: Sparkles },
  { title: "Reports", href: "/reports", icon: ClipboardList },
  { title: "Settings", href: "/settings", icon: Settings },
];

export const ADMIN_NAV_ITEM: NavItem = {
  title: "Admin",
  href: "/admin",
  icon: Shield,
};

export function navItemsForRole(role: Role): NavItem[] {
  if (!canAccessAdmin(role)) return NAV_ITEMS;
  return [...NAV_ITEMS, ADMIN_NAV_ITEM];
}

export function isNavActive(pathname: string, href: string) {
  if (href === "/facilities") return pathname === "/facilities";
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}
