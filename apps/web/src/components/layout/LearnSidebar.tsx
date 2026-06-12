import { useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Award,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  BookOpen,
  StickyNote,
  TrendingUp,
  Bot,
  Library,
  MessageSquare,
  MessageCircle,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils.js";
import { useAuth } from "@/hooks/useAuth.js";
import { EyeWordmark } from "@/components/brand/EyeWordmark.js";
import { NotificationBell } from "@/components/layout/NotificationBell.js";
import { useUnreadMessages } from "@/hooks/useUnreadMessages.js";

const FORMATION_PATHS = [
  "/learn/catalog",
  "/learn/courses",
  "/learn/notes",
  "/learn/progress",
  "/learn/ai",
  "/learn/library",
];

function linkClass(isActive: boolean): string {
  return cn(
    "flex items-center gap-3 border-l-2 px-3 py-2.5 text-xs font-semibold uppercase tracking-widest transition-all duration-200",
    isActive
      ? "border-teal-light bg-white/5 text-teal-light"
      : "border-transparent text-white/50 hover:translate-x-0.5 hover:bg-white/5 hover:text-white/80",
  );
}

function subLinkClass(isActive: boolean): string {
  return cn(
    "flex items-center gap-2.5 border-l-2 pl-8 pr-3 py-2 text-xs font-semibold uppercase tracking-widest transition-all duration-200",
    isActive
      ? "border-teal-light bg-white/5 text-teal-light"
      : "border-transparent text-white/40 hover:translate-x-0.5 hover:bg-white/5 hover:text-white/70",
  );
}

export function LearnSidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const unreadMessages = useUnreadMessages();

  const isFormationActive = FORMATION_PATHS.some((p) =>
    location.pathname.startsWith(p),
  );

  const [formationOpen, setFormationOpen] = useState(isFormationActive);

  function handleLogout(): void {
    logout();
    navigate("/login");
  }

  function toggleFormation(): void {
    setFormationOpen((v) => !v);
  }

  return (
    <aside className="fixed inset-y-0 left-0 w-56 bg-dark flex flex-col z-50">
      {/* Brand */}
      <div className="h-14 flex items-center px-6 border-b border-white/10 shrink-0">
        <EyeWordmark tone="paper" className="text-xl text-white" />
        <span className="ml-2 text-xs font-semibold uppercase tracking-widest text-white/60">
          Apprenant
        </span>
      </div>

      <nav
        aria-label="Navigation apprenant"
        className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto"
      >
        {/* Dashboard */}
        <NavLink
          to="/learn/dashboard"
          className={({ isActive }) => linkClass(isActive)}
        >
          <LayoutDashboard size={15} />
          <span>Tableau de bord</span>
        </NavLink>

        {/* Certificates sub-link (indented) */}
        <NavLink
          to="/learn/certificates"
          className={({ isActive }) => subLinkClass(isActive)}
        >
          <Award size={13} />
          <span>Certificats</span>
        </NavLink>

        {/* Formation collapsible */}
        <div className="pt-1">
          <button
            onClick={toggleFormation}
            className="flex w-full items-center gap-3 border-l-2 border-transparent px-3 py-2.5 text-xs font-semibold uppercase tracking-widest text-white/50 transition-all duration-200 hover:translate-x-0.5 hover:bg-white/5 hover:text-white/80"
          >
            <BookOpen size={15} />
            <span className="flex-1 text-left">Formation</span>
            {formationOpen ? (
              <ChevronDown size={13} />
            ) : (
              <ChevronRight size={13} />
            )}
          </button>

          {formationOpen && (
            <div className="space-y-0.5 mt-0.5">
              <NavLink
                to="/learn/catalog"
                className={({ isActive }) => subLinkClass(isActive)}
              >
                <GraduationCap size={13} />
                <span>Catalogue</span>
              </NavLink>

              <NavLink
                to="/learn/courses"
                end={false}
                className={({ isActive }) => subLinkClass(isActive)}
              >
                <BookOpen size={13} />
                <span>Mes formations</span>
              </NavLink>

              <NavLink
                to="/learn/notes"
                className={({ isActive }) => subLinkClass(isActive)}
              >
                <StickyNote size={13} />
                <span>Notes</span>
              </NavLink>

              <NavLink
                to="/learn/progress"
                className={({ isActive }) => subLinkClass(isActive)}
              >
                <TrendingUp size={13} />
                <span>Progression</span>
              </NavLink>

              <NavLink
                to="/learn/ai"
                className={({ isActive }) => subLinkClass(isActive)}
              >
                <Bot size={13} />
                <span>IA &amp; Documents</span>
              </NavLink>

              <NavLink
                to="/learn/library"
                className={({ isActive }) => subLinkClass(isActive)}
              >
                <Library size={13} />
                <span>Bibliothèque</span>
              </NavLink>
            </div>
          )}
        </div>

        {/* Messages */}
        <NavLink
          to="/learn/messages"
          className={({ isActive }) => linkClass(isActive)}
        >
          <MessageSquare size={15} />
          <span className="flex-1">Messages</span>
          {unreadMessages > 0 && (
            <span className="bg-rose text-white text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center">
              {unreadMessages > 9 ? "9+" : String(unreadMessages)}
            </span>
          )}
        </NavLink>

        {/* Forum */}
        <NavLink
          to="/learn/forums"
          className={({ isActive }) => linkClass(isActive)}
        >
          <MessageCircle size={15} />
          <span>Forum</span>
        </NavLink>

        {/* Settings */}
        <NavLink
          to="/learn/settings"
          className={({ isActive }) => linkClass(isActive)}
        >
          <Settings size={15} />
          <span>Paramètres</span>
        </NavLink>
      </nav>

      {/* Notification bell */}
      <NotificationBell />

      {/* User + logout */}
      <div className="px-3 py-4 border-t border-white/10 shrink-0">
        <div className="px-3 mb-2">
          <p className="text-xs text-white/80 font-medium truncate">
            {user?.firstName} {user?.lastName}
          </p>
          <p className="text-xs text-white/60 truncate">{user?.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 border-l-2 border-transparent px-3 py-2.5 text-xs font-semibold uppercase tracking-widest text-white/50 transition-all duration-200 hover:translate-x-0.5 hover:bg-white/5 hover:text-white/80"
        >
          <LogOut size={15} />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
