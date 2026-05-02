import { Navigate, Route, Routes } from "react-router-dom";
import { ManageShell } from "./ManageShell";
import { TodayView } from "./views/TodayView";
import { ClientsView } from "./views/ClientsView";
import { ScheduleView } from "./views/ScheduleView";
import { StudioView } from "./views/StudioView";
import { Placeholder } from "./views/Placeholder";
import { StaffGate } from "./components/StaffGate";

export function ManageApp() {
  return (
    <StaffGate>
      <Routes>
        <Route element={<ManageShell />}>
          <Route index element={<Navigate to="today" replace />} />
          <Route path="home" element={<Placeholder title="Home" />} />
          <Route path="today" element={<TodayView />} />
          <Route path="schedule" element={<ScheduleView />} />
          <Route path="clients" element={<ClientsView />} />
          <Route path="studio" element={<StudioView />} />
        </Route>
      </Routes>
    </StaffGate>
  );
}
