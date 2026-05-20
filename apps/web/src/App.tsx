import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth.js";
import { Shell } from "@/components/layout/Shell.js";
import { TeacherShell } from "@/components/layout/TeacherShell.js";
import { LoginPage } from "@/pages/Login.js";
import { DashboardPage } from "@/pages/Dashboard.js";
import { UserManagementPage } from "@/pages/users/UserManagement.js";
import { CourseManagementPage } from "@/pages/courses/CourseManagement.js";
import { DsrQueuePage } from "@/pages/gdpr/DsrQueue.js";
import { DsrDetailPage } from "@/pages/gdpr/DsrDetail.js";
import { AuditLogPage } from "@/pages/audit/AuditLog.js";
import { TeacherCoursesPage } from "@/pages/teacher/TeacherCourses.js";
import { TeacherCourseDetailPage } from "@/pages/teacher/TeacherCourseDetail.js";
import { TeacherCourseBuilderPage } from "@/pages/teacher/TeacherCourseBuilder.js";

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/teacher/courses" replace />;
  return <>{children}</>;
}

function RequireTeacher({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin, isInstructor } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin && !isInstructor) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Admin portal */}
      <Route
        path="/*"
        element={
          <RequireAdmin>
            <Shell>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/users" element={<UserManagementPage />} />
                <Route path="/courses" element={<CourseManagementPage />} />
                <Route path="/gdpr" element={<DsrQueuePage />} />
                <Route path="/gdpr/:userId" element={<DsrDetailPage />} />
                <Route path="/audit" element={<AuditLogPage />} />
              </Routes>
            </Shell>
          </RequireAdmin>
        }
      />

      {/* Teacher portal */}
      <Route
        path="/teacher/*"
        element={
          <RequireTeacher>
            <TeacherShell>
              <Routes>
                <Route path="/courses" element={<TeacherCoursesPage />} />
                <Route
                  path="/courses/:courseId"
                  element={<TeacherCourseDetailPage />}
                />
                <Route
                  path="/courses/:courseId/builder"
                  element={<TeacherCourseBuilderPage />}
                />
              </Routes>
            </TeacherShell>
          </RequireTeacher>
        }
      />
    </Routes>
  );
}
