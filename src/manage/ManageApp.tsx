import { Navigate, Route, Routes } from "react-router-dom";
import { ManageShell } from "./ManageShell";
import { TodayView } from "./views/TodayView";
import { Placeholder } from "./views/Placeholder";
import { StaffGate } from "./components/StaffGate";

export function ManageApp() {
  return (
    <StaffGate>
      <Routes>
        <Route element={<ManageShell />}>
        <Route index element={<Navigate to="today" replace />} />
        <Route path="today" element={<TodayView />} />
        <Route path="schedule" element={<Placeholder title="Schedule" />} />
        <Route path="clients" element={<Placeholder title="Clients" />} />
        <Route path="studio" element={<Placeholder title="Studio" />} />
      </Route>
      </Routes>
    </StaffGate>
  );
}
