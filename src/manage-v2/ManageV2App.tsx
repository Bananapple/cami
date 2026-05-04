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

  // Minimal command items for now — Phase 4.5 will wire real members + classes
  const commandItems: CommandItem[] = [
    { id: "home", group: "Navigation", label: "Home", onSelect: () => navigate("/manage/home") },
    { id: "schedule", group: "Navigation", label: "Schedule", onSelect: () => navigate("/manage/schedule") },
    { id: "clients", group: "Navigation", label: "Clients", onSelect: () => navigate("/manage/clients") },
    { id: "studio", group: "Navigation", label: "Studio settings", onSelect: () => navigate("/manage/studio") },
    { id: "signout", group: "Account", label: "Sign out", onSelect: () => signOut() },
  ];

  return (
    <StaffGate>
      <Shell
        active={active}
        onNavigate={(id) => navigate("/manage/" + id)}
        brandName={brandName}
        userInitials={userInitials}
        userName={userName}
        commandItems={commandItems}
      >
        <Routes>
          <Route index element={<Navigate to="home" replace />} />
          <Route path="home" element={<HomeScreen />} />
          <Route path="today" element={<TodayScreen />} />
          <Route path="schedule" element={<ScheduleScreen />} />
          <Route path="clients" element={<ClientsScreen />} />
          <Route path="studio" element={<StudioScreen />} />
        </Routes>
      </Shell>
    </StaffGate>
  );
}
