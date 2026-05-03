import { NavLink } from "react-router-dom";
import { LayoutDashboard, Calendar, CalendarDays, Users, Settings } from "lucide-react";
import { useStudioContext } from "@/context/StudioContext";

export function NavRail() {
  const ctx = useStudioContext();
  const isAdmin = ctx?.role === "owner" || ctx?.role === "manager";

  const items = [
    ...(isAdmin ? [{ to: "/manage/home", label: "Home", Icon: LayoutDashboard }] : []),
    { to: "/manage/today", label: "Today", Icon: Calendar },
    { to: "/manage/schedule", label: "Schedule", Icon: CalendarDays },
    { to: "/manage/clients", label: "Clients", Icon: Users },
    { to: "/manage/studio", label: "Studio", Icon: Settings },
  ];

  return (
    <nav className="w-16 border-r border-border bg-background flex flex-col items-center py-4 gap-2">
      {items.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `w-12 h-12 rounded-lg flex flex-col items-center justify-center text-[10px] gap-0.5 transition-colors ${
              isActive
                ? "bg-primary/10 text-primary"
                : "text-foreground/60 hover:text-foreground hover:bg-muted"
            }`
          }
        >
          <Icon className="w-4 h-4" />
          <span className="font-sans">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
