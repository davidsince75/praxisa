import { useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  LogOut,
  BarChart2,
  MessageSquare,
  Bot,
  Users,
  ClipboardList,
  BookOpen,
  ChevronDown,
  ChevronRight,
  MessageCircle,
  Settings,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils.js";
import { useAuth } from "@/hooks/useAuth.js";
import { NotificationBell } from "@/components/layout/NotificationBell.js";
import { useUnreadMessages } from "@/hooks/useUnreadMessages.js";

const ENSEIGNEMENT_PATHS = [
  "/teacher/courses",
  "/teacher/students",
  "/teacher/grading",
  "/teacher/analytics",
  "/teacher/ai",
];

function linkClass(isActive: boolean): string {
  return cn(
    "flex items-center gap-3 px-3 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors",
    isActive
      ? "text-teal bg-white/5"
      : "text-white/50 hover:text-white/80 hover:bg-white/5",
  );
}

function subLinkClass(isActive: boolean): string {
  return cn(
    "flex items-center gap-2.5 pl-8 pr-3 py-2 text-[11px] font-semibold uppercase tracking-widest transition-colors",
    isActive
      ? "text-teal bg-white/5"
      : "text-white/40 hover:text-white/70 hover:bg-white/5",
  );
}

export function TeacherSidebar() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const unreadMessages = useUnreadMessages();

  const isEnseignementActive = ENSEIGNEMENT_PATHS.some((p) =>
    location.pathname.startsWith(p),
  );
  const [enseignementOpen, setEnseignementOpen] =
    useState(isEnseignementActive);

  function handleLogout(): void {
    logout();
    navigate("/login");
  }

  function toggleEnseignement(): void {
    setEnseignementOpen((v) => !v);
  }

  return (
    <aside className="fixed inset-y-0 left-0 w-56 bg-dark flex flex-col z-50">
      {/* Logo */}
      <div className="h-14 flex items-center px-6 border-b border-white/10 shrink-0">
        <span className="text-white font-bold tracking-tight">
          <span className="text-teal">Psycho</span>study
        </span>
        <span className="ml-2 text-[10px] font-bold uppercase tracking-widest text-white/30">
          Formateur
        </span>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        {/* Enseignement collapsible */}
        <div>
          <button
            onClick={toggleEnseignement}
            className="flex items-center gap-3 w-full px-3 py-2.5 text-xs font-bold uppercase tracking-widest text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            <GraduationCap size={15} />
            <span className="flex-1 text-left">Enseignement</span>
            {enseignementOpen ? (
              <ChevronDown size={13} />
            ) : (
              <ChevronRight size={13} />
            )}
          </button>

          {enseignementOpen && (
            <div className="space-y-0.5 mt-0.5">
              <NavLink
                to="/teacher/courses"
                end={false}
                className={({ isActive }) => subLinkClass(isActive)}
              >
                <BookOpen size={13} />
                <span>Mes cours</span>
              </NavLink>
              <NavLink
                to="/teacher/students"
                className={({ isActive }) => subLinkClass(isActive)}
              >
                <Users size={13} />
                <span>Mes élèves</span>
              </NavLink>
              <NavLink
                to="/teacher/grading"
                className={({ isActive }) => subLinkClass(isActive)}
              >
                <ClipboardList size={13} />
                <span>Travaux</span>
              </NavLink>
              <NavLink
                to="/teacher/analytics"
                className={({ isActive }) => subLinkClass(isActive)}
              >
                <BarChart2 size={13} />
                <span>Analytiques</span>
              </NavLink>
              <NavLink
                to="/teacher/ai"
                className={({ isActive }) => subLinkClass(isActive)}
              >
                <Bot size={13} />
                <span>IA Ingest</span>
              </NavLink>
            </div>
          )}
        </div>

        {/* Messages */}
        <NavLink
          to="/teacher/messages"
          className={({ isActive }) => linkClass(isActive)}
        >
          <MessageSquare size={15} />
          <span className="flex-1">Messages</span>
          {unreadMessages > 0 && (
            <span className="bg-rose text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {unreadMessages > 9 ? "9+" : String(unreadMessages)}
            </span>
          )}
        </NavLink>

        {/* Forum */}
        <NavLink
          to="/teacher/forums"
          className={({ isActive }) => linkClass(isActive)}
        >
          <MessageCircle size={15} />
          <span>Forum</span>
        </NavLink>

        {/* Settings */}
        <NavLink
          to="/teacher/settings"
          className={({ isActive }) => linkClass(isActive)}
        >
          <Settings size={15} />
          <span>Paramètres</span>
        </NavLink>

        {/* Switch to admin portal (admin users only) */}
        {isAdmin && (
          <NavLink to="/" end className={({ isActive }) => linkClass(isActive)}>
            <LayoutDashboard size={15} />
            <span>Admin</span>
          </NavLink>
        )}
      </nav>

      {/* Notifications */}
      <NotificationBell />

      {/* User */}
      <div className="px-3 py-4 border-t border-white/10 shrink-0">
        <div className="px-3 mb-2">
          <p className="text-xs text-white/80 font-medium truncate">
            {user?.firstName} {user?.lastName}
          </p>
          <p className="text-[11px] text-white/30 truncate">{user?.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 text-xs font-bold uppercase tracking-widest text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
