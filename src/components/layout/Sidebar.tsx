import { useBarometerStore } from "@/store/useBarometerStore";
import { t } from "@/i18n/translations";
import { NavLink, useLocation } from "react-router-dom";
import { Home, BarChart3, Building2, Download, Upload, Settings } from "lucide-react";
import aquilaeLogo from "@/assets/aquilae-logo.png";

const navItems = [
  { path: "/", icon: Home, labelKey: "nav.home" },
  { path: "/group", icon: BarChart3, labelKey: "nav.group" },
  { path: "/office", icon: Building2, labelKey: "nav.office" },
  { path: "/exports", icon: Download, labelKey: "nav.export" },
  { path: "/admin", icon: Upload, labelKey: "nav.admin" },
  { path: "/settings", icon: Settings, labelKey: "nav.settings" },
];

export default function Sidebar() {
  const { language } = useBarometerStore();
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-60 flex-col border-r border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-5 py-4">
        <img src={aquilaeLogo} alt="Aquilae" className="h-8 w-auto" />
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {t(item.labelKey, language)}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
        Aquilae Barometer v1.0
      </div>
    </aside>
  );
}
