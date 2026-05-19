import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth.js";
import { Shell } from "@/components/layout/Shell.js";
import { LoginPage } from "@/pages/Login.js";
import { DashboardPage } from "@/pages/Dashboard.js";
import { DsrQueuePage } from "@/pages/gdpr/DsrQueue.js";
import { DsrDetailPage } from "@/pages/gdpr/DsrDetail.js";
import { AuditLogPage } from "@/pages/audit/AuditLog.js";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <Shell>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/gdpr" element={<DsrQueuePage />} />
                <Route path="/gdpr/:userId" element={<DsrDetailPage />} />
                <Route path="/audit" element={<AuditLogPage />} />
              </Routes>
            </Shell>
          </RequireAuth>
        }
      />
    </Routes>
  );
}
