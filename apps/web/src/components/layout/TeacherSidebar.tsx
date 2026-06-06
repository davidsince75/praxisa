import { NavLink, useNavigate } from "react-router-dom";
import {
  BookOpen,
  LayoutDashboard,
  LogOut,
  BarChart2,
  MessageSquare,
  Bot,
  Users,
  ClipboardList,
  MessageCircle,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils.js";
import { useAuth } from "@/hooks/useAuth.js";
import { NotificationBell } from "@/components/layout/NotificationBell.js";
import { useUnreadMessages } from "@/hooks/useUnreadMessages.js";

const nav = [
  { to: "/teacher/courses", label: "Mes cours", icon: BookOpen, end: false },
  { to: "/teacher/students", label: "Mes élèves", icon: Users, end: false },
  {
    to: "/teacher/grading",
    label: "Travaux",
    icon: ClipboardList,
    end: false,
  },
  {
    to: "/teacher/analytics",
    label: "Analytiques",
    icon: BarChart2,
    end: false,
  },
  {
    to: "/teacher/messages",
    label: "Messages",
    icon: MessageSquare,
    end: false,
  },
  { to: "/teacher/ai", label: "IA", icon: Bot, end: false },
  {
    to: "/teacher/forums",
    label: "Forum",
    icon: MessageCircle,
    end: false,
  },
  {
    to: "/teacher/settings",
    label: "Paramètres",
    icon: Settings,
    end: false,
  },
];

export function TeacherSidebar() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const unreadMessages = useUnreadMessages();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <aside className="fixed inset-y-0 left-0 w-56 bg-dark flex flex-col z-50">
      {/* Logo */}
      <div className="h-14 flex items-center px-6 border-b border-white/10">
        <span className="text-white font-bold tracking-tight">
          <span className="text-teal">Psycho</span>study
        </span>
        <span className="ml-2 text-[10px] font-bold uppercase tracking-widest text-white/30">
          Formateur
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-6 px-3 space-y-0.5">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors",
                isActive
                  ? "text-teal bg-white/5"
                  : "text-white/50 hover:text-white/80 hover:bg-white/5",
              )
            }
          >
            <Icon size={15} />
            <span className="flex-1">{label}</span>
            {to === "/teacher/messages" && unreadMessages > 0 && (
              <span className="ml-auto bg-rose text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {unreadMessages > 9 ? "9+" : String(unreadMessages)}
              </span>
            )}
          </NavLink>
        ))}
        {isAdmin && (
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors",
                isActive
                  ? "text-teal bg-white/5"
                  : "text-white/50 hover:text-white/80 hover:bg-white/5",
              )
            }
          >
            <LayoutDashboard size={15} />
            Admin
          </NavLink>
        )}
      </nav>

      {/* Notifications */}
      <NotificationBell />

      {/* User */}
      <div className="px-3 py-4 border-t border-white/10">
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
