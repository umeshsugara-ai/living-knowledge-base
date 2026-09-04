import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext.js";
import { LoginGate } from "./auth/LoginGate.js";
import { AppShell } from "./layout/AppShell.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { SourcesPage } from "./pages/SourcesPage.js";
import { SessionsListPage } from "./pages/sessions/SessionsListPage.js";
import { SessionDetailPage } from "./pages/sessions/SessionDetailPage.js";
import { BrainPage } from "./pages/BrainPage.js";
import { CalendarPage } from "./pages/CalendarPage.js";
import { SettingsPage } from "./pages/SettingsPage.js";

export function App(): React.ReactElement {
  return (
    <AuthProvider>
      <LoginGate>
        <BrowserRouter>
          <AppShell>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/sessions" element={<SessionsListPage />} />
              <Route path="/sessions/:id" element={<SessionDetailPage />} />
              <Route path="/brain" element={<BrainPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/sources" element={<SourcesPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </AppShell>
        </BrowserRouter>
      </LoginGate>
    </AuthProvider>
  );
}
