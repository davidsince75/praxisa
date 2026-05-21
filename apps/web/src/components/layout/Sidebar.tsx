import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ShieldCheck,
  ScrollText,
  LogOut,
  Users,
  BookOpen,
  BarChart2,
  MessageSquare,
  Bot,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils.js";
import { useAuth } from "@/hooks/useAuth.js";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/users", label: "Utilisateurs", icon: Users, end: false },
  { to: "/courses", label: "Cours", icon: BookOpen, end: false },
  { to: "/analytics", label: "Analytiques", icon: BarChart2, end: false },
  { to: "/messages", label: "Messages", icon: MessageSquare, end: false },
  { to: "/ai-assistant", label: "IA", icon: Bot, end: false },
  { to: "/campaigns", label: "Campagnes", icon: Mail, end: false },
  { to: "/gdpr", label: "DSR Queue", icon: ShieldCheck, end: false },
  { to: "/audit", label: "Audit Log", icon: ScrollText, end: false },
];

export function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="fixed inset-y-0 left-0 w-56 bg-dark flex flex-col z-50">
      {/* Logo */}
      <div className="h-14 flex items-center px-6 border-b border-white/10">
        <span className="text-white font-bold tracking-tight">
          Praxi<span className="text-teal">sa</span>
        </span>
        <span className="ml-2 text-[10px] font-bold uppercase tracking-widest text-white/30">
          Admin
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
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-white/10">
        <div className="px-3 mb-2">
          <p className="text-xs text-white/80 font-medium truncate">
            {user?.firstName} {user?.lastName}
          </p>
          <p className="text-[11px] text-white/30 truncate">{user?.email}</p>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2.5 text-xs font-bold uppercase tracking-widest text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
