import { useBarometerStore } from "@/store/useBarometerStore";
import { t } from "@/i18n/translations";
import { NavLink, useLocation } from "react-router-dom";
import { Home, BarChart3, Building2, Download, Upload, Settings, PanelLeftClose, PanelLeft } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useIsAdmin } from "@/hooks/useIsAdmin";

const publicNavItems = [
  { path: "/", icon: Home, labelKey: "nav.home" },
  { path: "/group", icon: BarChart3, labelKey: "nav.group" },
  { path: "/office", icon: Building2, labelKey: "nav.office" },
  { path: "/exports", icon: Download, labelKey: "nav.export" },
];

const adminNavItems = [
  { path: "/admin", icon: Upload, labelKey: "nav.admin" },
  { path: "/settings", icon: Settings, labelKey: "nav.settings" },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { language } = useBarometerStore();
  const location = useLocation();
  const isAdmin = useIsAdmin();
  const navItems = isAdmin ? [...publicNavItems, ...adminNavItems] : publicNavItems;

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={`fixed left-0 top-0 z-30 flex h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        <div className={`flex items-center border-b border-sidebar-border px-3 py-3 ${collapsed ? "justify-center" : "justify-between"}`}>
          {!collapsed && (
            <span className="ml-2 text-lg font-bold tracking-[0.18em] text-sidebar-foreground">
              AQUILAE
            </span>
          )}
          <button
            onClick={onToggle}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors active:scale-95"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const label = t(item.labelKey, language);
              const link = (
                <NavLink
                  to={item.path}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    collapsed ? "justify-center" : ""
                  } ${
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && label}
                </NavLink>
              );

              return (
                <li key={item.path}>
                  {collapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right">{label}</TooltipContent>
                    </Tooltip>
                  ) : (
                    link
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {!collapsed && (
          <div className="border-t border-sidebar-border px-5 py-3 text-xs text-sidebar-foreground/60">
            Aquilae Barometer v1.0
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
}
