import { useState, useMemo } from "react";
import { Routes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";
import { Shell } from "./shell/Shell";
import type { NavId } from "./shell/NavRail";
import type { CommandItem } from "./components/CommandPalette";
import { StudioScreen } from "./screens/StudioScreen";
import { ScheduleScreen } from "./screens/ScheduleScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { useStudioContext } from "@/context/StudioContext";
import { useAuth } from "@/hooks/useAuth";
import { StaffGate } from "@/manage/components/StaffGate";

// Stub screens — replaced as Phase 4 progresses
const TodayStub = () => <p style={{ color: "var(--ink-muted)" }}>Today screen — TBD.</p>;
const ClientsStub = () => <p style={{ color: "var(--ink-muted)" }}>Clients screen — Phase 4.5.</p>;

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
    { id: "home", group: "Navigation", label: "Home", onSelect: () => navigate("/_v2/home") },
    { id: "schedule", group: "Navigation", label: "Schedule", onSelect: () => navigate("/_v2/schedule") },
    { id: "clients", group: "Navigation", label: "Clients", onSelect: () => navigate("/_v2/clients") },
    { id: "studio", group: "Navigation", label: "Studio settings", onSelect: () => navigate("/_v2/studio") },
    { id: "signout", group: "Account", label: "Sign out", onSelect: () => signOut() },
  ];

  return (
    <StaffGate>
      <Shell
        active={active}
        onNavigate={(id) => navigate("/_v2/" + id)}
        brandName={brandName}
        userInitials={userInitials}
        userName={userName}
        commandItems={commandItems}
      >
        <Routes>
          <Route index element={<Navigate to="home" replace />} />
          <Route path="home" element={<HomeScreen />} />
          <Route path="today" element={<TodayStub />} />
          <Route path="schedule" element={<ScheduleScreen />} />
          <Route path="clients" element={<ClientsStub />} />
          <Route path="studio" element={<StudioScreen />} />
        </Routes>
      </Shell>
    </StaffGate>
  );
}
