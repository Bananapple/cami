import { Navigate, Route, Routes } from "react-router-dom";
import { ManageShell } from "./ManageShell";
import { TodayView } from "./views/TodayView";
import { ClientsView } from "./views/ClientsView";
import { ScheduleView } from "./views/ScheduleView";
import { StudioView } from "./views/StudioView";
import { HomeView } from "./views/HomeView";
import { StaffGate } from "./components/StaffGate";
import { useStudioContext } from "@/context/StudioContext";

function DefaultRedirect() {
  const ctx = useStudioContext();
  const isAdmin = ctx?.role === "admin";
  return <Navigate to={isAdmin ? "home" : "today"} replace />;
}

export function ManageApp() {
  return (
    <StaffGate>
      <Routes>
        <Route element={<ManageShell />}>
          <Route index element={<DefaultRedirect />} />
          <Route path="home" element={<HomeView />} />
          <Route path="today" element={<TodayView />} />
          <Route path="schedule" element={<ScheduleView />} />
          <Route path="clients" element={<ClientsView />} />
          <Route path="studio" element={<StudioView />} />
        </Route>
      </Routes>
    </StaffGate>
  );
}
