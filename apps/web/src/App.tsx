import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth.js";
import { Shell } from "@/components/layout/Shell.js";
import { TeacherShell } from "@/components/layout/TeacherShell.js";
import { LearnShell } from "@/components/layout/LearnShell.js";
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
import { TeacherLessonEditorPage } from "@/pages/teacher/TeacherLessonEditor.js";
import { LearnCatalogPage } from "@/pages/learn/LearnCatalog.js";
import { LearnBuyCoursePage } from "@/pages/learn/LearnBuyCourse.js";
import { LearnMyCoursesPage } from "@/pages/learn/LearnMyCourses.js";
import { LearnCoursePlayerPage } from "@/pages/learn/LearnCoursePlayer.js";
import { LearnCertificatePage } from "@/pages/learn/LearnCertificate.js";
import { AdminAnalytics } from "@/pages/analytics/AdminAnalytics.js";
import { TeacherAnalytics } from "@/pages/analytics/TeacherAnalytics.js";
import { LearnProgress } from "@/pages/analytics/LearnProgress.js";
import { AdminMessagesPage } from "@/pages/messages/AdminMessages.js";
import { TeacherMessagesPage } from "@/pages/teacher/TeacherMessages.js";
import { TeacherGradingPage } from "@/pages/teacher/TeacherGrading.js";
import { TeacherGradingOverviewPage } from "@/pages/teacher/TeacherGradingOverview.js";
import { TeacherStudentsPage } from "@/pages/teacher/TeacherStudents.js";
import { TeacherStudentDetailPage } from "@/pages/teacher/TeacherStudentDetail.js";
import { LearnMessagesPage } from "@/pages/learn/LearnMessages.js";
import { LearnAIChatPage } from "@/pages/learn/LearnAIChat.js";
import { LearnCertificatesPage } from "@/pages/learn/LearnCertificates.js";
import { TeacherAIIngestPage } from "@/pages/teacher/TeacherAIIngest.js";
import { AdminAIDraftPage } from "@/pages/ai/AdminAIDraft.js";
import { AdminCampaignsPage } from "@/pages/campaigns/AdminCampaigns.js";
import { AdminEmailPage } from "@/pages/AdminEmail.js";
import { AdminPaymentsPage } from "@/pages/AdminPayments.js";
import { DataImportPage } from "@/pages/import/DataImport.js";
import { SettingsPage } from "@/pages/settings/SettingsPage.js";
import { LearnDocumentsPage } from "@/pages/learn/LearnDocuments.js";
import { ForumsPage } from "@/pages/learn/LearnForums.js";
import { ForumThreadPage } from "@/pages/learn/LearnForumThread.js";
import { LearnDashboardPage } from "@/pages/learn/LearnDashboard.js";
import { LearnNotesPage } from "@/pages/learn/LearnNotes.js";
import { LearnLibraryPage } from "@/pages/learn/LearnLibrary.js";
import { LearnSettingsPage } from "@/pages/learn/LearnSettings.js";

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin, isInstructor, isStudent } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin) {
    if (isInstructor) return <Navigate to="/teacher/courses" replace />;
    if (isStudent) return <Navigate to="/learn/dashboard" replace />;
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function RequireTeacher({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin, isInstructor } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin && !isInstructor) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireStudent({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin, isStudent } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin && !isStudent) return <Navigate to="/login" replace />;
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
                <Route
                  path="/courses/:courseId/builder"
                  element={
                    <TeacherCourseBuilderPage basePath="" backTo="/courses" />
                  }
                />
                <Route
                  path="/courses/:courseId/modules/:moduleId/lessons/:lessonId"
                  element={<TeacherLessonEditorPage basePath="" />}
                />
                <Route path="/analytics" element={<AdminAnalytics />} />
                <Route path="/messages" element={<AdminMessagesPage />} />
                <Route path="/gdpr" element={<DsrQueuePage />} />
                <Route path="/gdpr/:userId" element={<DsrDetailPage />} />
                <Route path="/audit" element={<AuditLogPage />} />
                <Route path="/ai-assistant" element={<AdminAIDraftPage />} />
                <Route path="/campaigns" element={<AdminCampaignsPage />} />
                <Route path="/email" element={<AdminEmailPage />} />
                <Route path="/payments" element={<AdminPaymentsPage />} />
                <Route path="/import" element={<DataImportPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/forums" element={<ForumsPage basePath="" />} />
                <Route
                  path="/forums/:threadId"
                  element={<ForumThreadPage backPath="/forums" />}
                />
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
                <Route path="/students" element={<TeacherStudentsPage />} />
                <Route
                  path="/students/:studentId"
                  element={<TeacherStudentDetailPage />}
                />
                <Route
                  path="/courses/:courseId"
                  element={<TeacherCourseDetailPage />}
                />
                <Route
                  path="/courses/:courseId/builder"
                  element={<TeacherCourseBuilderPage />}
                />
                <Route
                  path="/courses/:courseId/modules/:moduleId/lessons/:lessonId"
                  element={<TeacherLessonEditorPage />}
                />
                <Route path="/analytics" element={<TeacherAnalytics />} />
                <Route
                  path="/grading"
                  element={<TeacherGradingOverviewPage />}
                />
                <Route path="/messages" element={<TeacherMessagesPage />} />
                <Route
                  path="/courses/:courseId/grading"
                  element={<TeacherGradingPage />}
                />
                <Route path="/ai" element={<TeacherAIIngestPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route
                  path="/forums"
                  element={<ForumsPage basePath="/teacher" />}
                />
                <Route
                  path="/forums/:threadId"
                  element={<ForumThreadPage backPath="/teacher/forums" />}
                />
              </Routes>
            </TeacherShell>
          </RequireTeacher>
        }
      />

      {/* Learner portal */}
      <Route
        path="/learn/*"
        element={
          <RequireStudent>
            <LearnShell>
              <Routes>
                <Route
                  path="/"
                  element={<Navigate to="/learn/dashboard" replace />}
                />
                <Route path="/dashboard" element={<LearnDashboardPage />} />
                <Route path="/catalog" element={<LearnCatalogPage />} />
                <Route
                  path="/courses/:courseId/buy"
                  element={<LearnBuyCoursePage />}
                />
                <Route path="/courses" element={<LearnMyCoursesPage />} />
                <Route
                  path="/courses/:enrolmentId"
                  element={<LearnCoursePlayerPage />}
                />
                <Route
                  path="/courses/:enrolmentId/certificate"
                  element={<LearnCertificatePage />}
                />
                <Route path="/progress" element={<LearnProgress />} />
                <Route
                  path="/certificates"
                  element={<LearnCertificatesPage />}
                />
                <Route path="/messages" element={<LearnMessagesPage />} />
                <Route path="/ai" element={<LearnAIChatPage />} />
                <Route path="/documents" element={<LearnDocumentsPage />} />
                <Route path="/notes" element={<LearnNotesPage />} />
                <Route path="/library" element={<LearnLibraryPage />} />
                <Route path="/settings" element={<LearnSettingsPage />} />
                <Route
                  path="/forums"
                  element={<ForumsPage basePath="/learn" />}
                />
                <Route
                  path="/forums/:threadId"
                  element={<ForumThreadPage backPath="/learn/forums" />}
                />
              </Routes>
            </LearnShell>
          </RequireStudent>
        }
      />
    </Routes>
  );
}
