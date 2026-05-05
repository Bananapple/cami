import { useState, useMemo } from "react";
import { Routes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";
import { Shell } from "./shell/Shell";
import type { NavId } from "./shell/NavRail";
import type { CommandItem } from "./components/CommandPalette";
import { StudioScreen } from "./screens/StudioScreen";
import { ScheduleScreen } from "./screens/ScheduleScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { ClientsScreen } from "./screens/ClientsScreen";
import { TodayScreen } from "./screens/TodayScreen";
import { useStudioContext } from "@/context/StudioContext";
import { useAuth } from "@/hooks/useAuth";
import { StaffGate } from "@/manage/components/StaffGate";
import { useClientsView } from "@/manage/hooks/useClientsView";
import { MemberDrawerV2 } from "./drawers/MemberDrawer";
import { useMyStudioRole } from "@/manage/hooks/useMyStudioRole";
import type { NavId } from "./shell/NavRail";


export function ManageV2App() {
  const navigate = useNavigate();
  const location = useLocation();
  const studioCtx = useStudioContext();
  const { user, signOut } = useAuth();

  const active: NavId = useMemo(() => {
    const path = location.pathname.split("/").pop() ?? "home";
    if (["home", "today", "schedule", "clients", "studio"].includes(path)) return path as NavId;
    return "home";
  }, [location.pathname]);

  const brandName = studioCtx?.studio?.name ?? "Studio";
  const userName = user?.user_metadata?.full_name ?? user?.email?.split("@")[0] ?? "—";
  const userInitials = userName
    .split(" ")
    .map((s: string) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const { members } = useClientsView();
  const [paletteMemberId, setPaletteMemberId] = useState<string | null>(null);
  const { data: myRole } = useMyStudioRole();

  // Associates (instructor role) only see Today + Schedule
  const hiddenIds: NavId[] = myRole === "instructor" ? ["home", "clients", "studio"] : [];

  const commandItems: CommandItem[] = useMemo(() => {
    const nav: CommandItem[] = [
      { id: "home", group: "Navigation", label: "Home", onSelect: () => navigate("/manage/home") },
      { id: "today", group: "Navigation", label: "Today", onSelect: () => navigate("/manage/today") },
      { id: "schedule", group: "Navigation", label: "Schedule", onSelect: () => navigate("/manage/schedule") },
      { id: "clients", group: "Navigation", label: "Clients", onSelect: () => navigate("/manage/clients") },
      { id: "studio", group: "Navigation", label: "Studio settings", onSelect: () => navigate("/manage/studio") },
      { id: "signout", group: "Account", label: "Sign out", onSelect: () => signOut() },
    ];
    const memberItems: CommandItem[] = members.map((m) => ({
      id: `member_${m.user_id}`,
      group: "Members",
      label: m.full_name ?? m.email ?? m.user_id,
      meta: m.email ?? undefined,
      lead: (m.full_name ?? "?").slice(0, 2).toUpperCase(),
      onSelect: () => {
        navigate("/manage/clients");
        setPaletteMemberId(m.user_id);
      },
    }));
    return [...nav, ...memberItems];
  }, [members, navigate, signOut]);

  return (
    <StaffGate>
      <Shell
        active={active}
        onNavigate={(id) => navigate("/manage/" + id)}
        brandName={brandName}
        userInitials={userInitials}
        userName={userName}
        commandItems={commandItems}
        onSignOut={signOut}
        hiddenIds={hiddenIds}
      >
        <Routes>
          <Route
            index
            element={<Navigate to={myRole === "instructor" ? "today" : "home"} replace />}
          />
          <Route
            path="home"
            element={myRole === "instructor" ? <Navigate to="today" replace /> : <HomeScreen />}
          />
          <Route path="today" element={<TodayScreen />} />
          <Route path="schedule" element={<ScheduleScreen />} />
          <Route
            path="clients"
            element={myRole === "instructor" ? <Navigate to="today" replace /> : <ClientsScreen />}
          />
          <Route
            path="studio"
            element={myRole === "instructor" ? <Navigate to="today" replace /> : <StudioScreen />}
          />
        </Routes>
      </Shell>
      {paletteMemberId && (
        <MemberDrawerV2
          userId={paletteMemberId}
          open={!!paletteMemberId}
          onClose={() => setPaletteMemberId(null)}
        />
      )}
    </StaffGate>
  );
}
