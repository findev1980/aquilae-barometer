import { useBarometerStore } from "@/store/useBarometerStore";
import { t } from "@/i18n/translations";
import { NavLink, useLocation } from "react-router-dom";
import { Home, BarChart3, Building2, Download, Upload, Settings, PanelLeftClose, PanelLeft } from "lucide-react";
import aquilaeLogo from "@/assets/aquilae-logo.png";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

const navItems = [
  { path: "/", icon: Home, labelKey: "nav.home" },
  { path: "/group", icon: BarChart3, labelKey: "nav.group" },
  { path: "/office", icon: Building2, labelKey: "nav.office" },
  { path: "/exports", icon: Download, labelKey: "nav.export" },
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

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={`fixed left-0 top-0 z-30 flex h-screen flex-col border-r border-border bg-card transition-[width] duration-200 ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-3 py-4">
          {!collapsed && <img src={aquilaeLogo} alt="Aquilae" className="h-8 w-auto ml-2" />}
          <button
            onClick={onToggle}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors active:scale-95 mx-auto"
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
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
          <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
            Aquilae Barometer v1.0
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
}
