"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronDown, ChevronsLeft, ChevronsRight, LogOut, Menu } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ROLE_LABELS, canAccessAdmin, type Role } from "@/lib/permissions";
import { setActiveFacility, setActiveOrganization } from "@/server/actions/preferences";
import { signOutAction } from "@/server/actions/session";

import { isNavActive, navItemsForRole, type NavItem } from "./navigation";

export type ShellMembership = {
  organizationId: string;
  name: string;
  slug: string;
  role: Role;
};

export type ShellFacility = {
  id: string;
  name: string;
};

export type ShellModel = {
  name: string | null;
  email: string;
  role: Role;
  organizationId: string;
  organizationName: string;
  facilityId: string | null;
  memberships: ShellMembership[];
  facilities: ShellFacility[];
  openInsights: number;
};

function NavLinks({
  pathname,
  collapsed,
  onNavigate,
  role,
}: {
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
  role: Role;
}) {
  return (
    <nav className="flex flex-col gap-1">
      {navItemsForRole(role).map((item) => (
        <NavBlock
          key={item.title}
          item={item}
          pathname={pathname}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}

function NavBlock({
  item,
  pathname,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const childActive = item.children?.some((child) => isNavActive(pathname, child.href)) ?? false;
  const active = childActive || isNavActive(pathname, item.href);
  const Icon = item.icon;

  return (
    <div>
      <Link
        href={item.href}
        title={item.title}
        onClick={onNavigate}
        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
          active
            ? "bg-indigo-500/20 text-white"
            : "text-slate-300 hover:bg-white/5 hover:text-white"
        } ${collapsed ? "justify-center px-2" : ""}`}
      >
        <Icon className="size-4 shrink-0" />
        {collapsed ? <span className="sr-only">{item.title}</span> : <span>{item.title}</span>}
      </Link>
      {!collapsed && item.children && (active || childActive) ? (
        <div className="mt-1 ml-4 flex flex-col gap-0.5 border-l border-white/10 pl-3">
          {item.children.map((child) => {
            const childIsActive = isNavActive(pathname, child.href);
            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={onNavigate}
                className={`rounded-md px-2 py-1.5 text-[13px] ${
                  childIsActive ? "text-indigo-200" : "text-slate-400 hover:text-slate-100"
                }`}
              >
                {child.title}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function OrgSwitcher({ model, compact }: { model: ShellModel; compact: boolean }) {
  if (model.memberships.length <= 1) {
    return (
      <div className={compact ? "sr-only" : "px-1"}>
        <p className="text-[11px] tracking-wide text-slate-400 uppercase">Organization</p>
        <p className="truncate text-sm text-white">{model.organizationName}</p>
      </div>
    );
  }

  return (
    <Select
      value={model.organizationId}
      onValueChange={(value) => void setActiveOrganization(value)}
    >
      <SelectTrigger className="w-full border-white/10 bg-white/5 text-white">
        <SelectValue placeholder="Organization" />
      </SelectTrigger>
      <SelectContent>
        {model.memberships.map((membership) => (
          <SelectItem key={membership.organizationId} value={membership.organizationId}>
            {membership.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SidebarBody({
  model,
  collapsed,
  onNavigate,
}: {
  model: ShellModel;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col bg-[#0B1220] text-slate-200">
      <div
        className={`flex items-center gap-3 px-4 py-4 ${collapsed ? "justify-center px-2" : ""}`}
      >
        <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-500 text-sm font-semibold text-white">
          FQ
        </div>
        {collapsed ? null : (
          <div>
            <p className="text-sm font-semibold text-white">FacilityIQ</p>
            <p className="text-[11px] text-slate-400">Operations intelligence</p>
          </div>
        )}
      </div>
      <div className="px-3 pb-3">
        <OrgSwitcher model={model} compact={collapsed} />
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        <NavLinks
          pathname={pathname}
          collapsed={collapsed}
          onNavigate={onNavigate}
          role={model.role}
        />
      </div>
    </div>
  );
}

function Breadcrumbs() {
  const pathname = usePathname();
  const labels: Record<string, string> = {
    dashboard: "Dashboard",
    facilities: "Facilities",
    twin: "3D Digital Twin",
    areas: "Areas",
    assets: "Assets",
    layouts: "Layouts",
    operations: "Operations",
    throughput: "Throughput",
    utilization: "Utilization",
    bottlenecks: "Bottlenecks",
    finance: "Finance",
    "operating-costs": "Operating Costs",
    "cost-per-order": "Cost per Order",
    "asset-costs": "Asset Costs",
    scenarios: "Scenarios",
    insights: "AI Insights",
    reports: "Reports",
    settings: "Settings",
    admin: "Admin",
  };
  const parts = pathname.split("/").filter(Boolean);
  const crumbs = parts.map((part, index) => ({
    label: labels[part] ?? part,
    href: `/${parts.slice(0, index + 1).join("/")}`,
  }));

  return (
    <ol className="flex min-w-0 items-center gap-1 text-sm text-slate-500">
      {crumbs.map((crumb, index) => (
        <li key={crumb.href} className="flex min-w-0 items-center gap-1">
          {index > 0 ? <span className="text-slate-300">/</span> : null}
          {index === crumbs.length - 1 ? (
            <span className="truncate font-medium text-slate-800">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="truncate hover:text-indigo-700">
              {crumb.label}
            </Link>
          )}
        </li>
      ))}
    </ol>
  );
}

export function AppShell({ model, children }: { model: ShellModel; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const initials = (model.name ?? model.email)
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex min-h-screen bg-[#f4f6fb] text-slate-900">
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 border-r border-[#172033] transition-[width] md:block ${
          collapsed ? "w-[4.5rem]" : "w-64"
        }`}
      >
        <SidebarBody model={model} collapsed={collapsed} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-3 backdrop-blur md:px-5">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="md:hidden"
                aria-label="Open navigation"
              >
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-none bg-[#0B1220] p-0 text-white">
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <SidebarBody
                model={model}
                collapsed={false}
                onNavigate={() => setMobileOpen(false)}
              />
            </SheetContent>
          </Sheet>
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronsRight /> : <ChevronsLeft />}
          </Button>
          <Breadcrumbs />
          <div className="ml-auto flex items-center gap-2">
            <Select
              value={model.facilityId ?? undefined}
              onValueChange={(value) => void setActiveFacility(value)}
              disabled={model.facilities.length === 0}
            >
              <SelectTrigger className="hidden w-56 sm:flex" aria-label="Facility">
                <SelectValue placeholder="No facility" />
              </SelectTrigger>
              <SelectContent>
                {model.facilities.map((facility) => (
                  <SelectItem key={facility.id} value={facility.id}>
                    {facility.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="relative"
                  aria-label="Notifications"
                >
                  <Bell />
                  {model.openInsights > 0 ? (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white">
                      {model.openInsights}
                    </span>
                  ) : null}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="px-2 py-3 text-sm text-slate-600">
                  Alert delivery is not wired yet.
                  {model.openInsights > 0
                    ? ` ${model.openInsights} open insights are already on file.`
                    : " Nothing is waiting in this inbox."}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-8 gap-2 px-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-semibold text-white">
                    {initials}
                  </span>
                  <span className="hidden max-w-32 truncate text-left text-sm md:block">
                    {model.name ?? model.email}
                  </span>
                  <ChevronDown className="size-3 text-slate-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>
                  <span className="block text-sm text-slate-900">{model.name}</span>
                  <span className="block text-xs font-normal text-slate-500">{model.email}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5">
                  <Badge variant="secondary">{ROLE_LABELS[model.role]}</Badge>
                </div>
                <DropdownMenuItem asChild>
                  <Link href="/settings">Settings</Link>
                </DropdownMenuItem>
                {canAccessAdmin(model.role) ? (
                  <DropdownMenuItem asChild>
                    <Link href="/admin">Organization settings</Link>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <form action={signOutAction} className="w-full">
                    <button type="submit" className="flex w-full items-center gap-2">
                      <LogOut className="size-4" />
                      Sign out
                    </button>
                  </form>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
