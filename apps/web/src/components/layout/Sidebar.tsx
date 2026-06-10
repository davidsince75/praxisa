import { useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
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
  Upload,
  MessageCircle,
  Settings,
  Inbox,
  CreditCard,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  ClipboardList,
  Layers,
  Megaphone,
  TrendingUp,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils.js";
import { useAuth } from "@/hooks/useAuth.js";
import { NotificationBell } from "@/components/layout/NotificationBell.js";
import { useUnreadMessages } from "@/hooks/useUnreadMessages.js";

const PLATEFORME_PATHS = [
  "/users",
  "/courses",
  "/email",
  "/payments",
  "/import",
];
const COMMUNICATION_PATHS = ["/messages", "/campaigns", "/forums"];
const ANALYSES_PATHS = ["/analytics", "/ai-assistant"];
const SYSTEME_PATHS = ["/gdpr", "/audit", "/settings"];
const FORMATEUR_PATHS = ["/teacher"];

function linkClass(isActive: boolean): string {
  return cn(
    "flex items-center gap-3 px-3 py-2.5 text-xs font-semibold uppercase tracking-widest transition-colors",
    isActive
      ? "text-teal-light bg-white/5"
      : "text-white/50 hover:text-white/80 hover:bg-white/5",
  );
}

function subLinkClass(isActive: boolean): string {
  return cn(
    "flex items-center gap-2.5 pl-8 pr-3 py-2 text-xs font-semibold uppercase tracking-widest transition-colors",
    isActive
      ? "text-teal-light bg-white/5"
      : "text-white/40 hover:text-white/70 hover:bg-white/5",
  );
}

interface GroupToggleProps {
  label: string;
  icon: LucideIcon;
  open: boolean;
  onToggle: () => void;
}

function GroupToggle({ label, icon: Icon, open, onToggle }: GroupToggleProps) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-3 w-full px-3 py-2.5 text-xs font-semibold uppercase tracking-widest text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
    >
      <Icon size={15} />
      <span className="flex-1 text-left">{label}</span>
      {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
    </button>
  );
}

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const unreadMessages = useUnreadMessages();

  const [plateformeOpen, setPlateformeOpen] = useState(
    PLATEFORME_PATHS.some((p) => location.pathname.startsWith(p)),
  );
  const [communicationOpen, setCommunicationOpen] = useState(
    COMMUNICATION_PATHS.some((p) => location.pathname.startsWith(p)),
  );
  const [analysesOpen, setAnalysesOpen] = useState(
    ANALYSES_PATHS.some((p) => location.pathname.startsWith(p)),
  );
  const [systemeOpen, setSystemeOpen] = useState(
    SYSTEME_PATHS.some((p) => location.pathname.startsWith(p)),
  );
  const [formateurOpen, setFormateurOpen] = useState(
    FORMATEUR_PATHS.some((p) => location.pathname.startsWith(p)),
  );

  function handleLogout(): void {
    logout();
    navigate("/login");
  }

  return (
    <aside className="fixed inset-y-0 left-0 w-56 bg-dark flex flex-col z-50">
      {/* Logo */}
      <div className="h-14 flex items-center px-6 border-b border-white/10 shrink-0">
        <span className="text-white font-semibold tracking-tight">
          <span className="text-teal-light">Psycho</span>study
        </span>
        <span className="ml-2 text-xs font-semibold uppercase tracking-widest text-white/60">
          Admin
        </span>
      </div>

      <nav
        aria-label="Navigation administrateur"
        className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto"
      >
        {/* Dashboard */}
        <NavLink to="/" end className={({ isActive }) => linkClass(isActive)}>
          <LayoutDashboard size={15} />
          <span>Dashboard</span>
        </NavLink>

        {/* Plateforme */}
        <div className="pt-1">
          <GroupToggle
            label="Plateforme"
            icon={Layers}
            open={plateformeOpen}
            onToggle={() => {
              setPlateformeOpen((v) => !v);
            }}
          />
          {plateformeOpen && (
            <div className="space-y-0.5 mt-0.5">
              <NavLink
                to="/users"
                className={({ isActive }) => subLinkClass(isActive)}
              >
                <Users size={13} />
                <span>Utilisateurs</span>
              </NavLink>
              <NavLink
                to="/courses"
                end={false}
                className={({ isActive }) => subLinkClass(isActive)}
              >
                <BookOpen size={13} />
                <span>Cours / Modules</span>
              </NavLink>
              <NavLink
                to="/email"
                className={({ isActive }) => subLinkClass(isActive)}
              >
                <Inbox size={13} />
                <span>Admissions</span>
              </NavLink>
              <NavLink
                to="/payments"
                className={({ isActive }) => subLinkClass(isActive)}
              >
                <CreditCard size={13} />
                <span>Paiements</span>
              </NavLink>
              <NavLink
                to="/import"
                className={({ isActive }) => subLinkClass(isActive)}
              >
                <Upload size={13} />
                <span>Import</span>
              </NavLink>
            </div>
          )}
        </div>

        {/* Communication */}
        <div className="pt-1">
          <GroupToggle
            label="Communication"
            icon={Megaphone}
            open={communicationOpen}
            onToggle={() => {
              setCommunicationOpen((v) => !v);
            }}
          />
          {communicationOpen && (
            <div className="space-y-0.5 mt-0.5">
              <NavLink
                to="/messages"
                className={({ isActive }) => subLinkClass(isActive)}
              >
                <MessageSquare size={13} />
                <span className="flex-1">Messages</span>
                {unreadMessages > 0 && (
                  <span className="bg-rose text-white text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center">
                    {unreadMessages > 9 ? "9+" : String(unreadMessages)}
                  </span>
                )}
              </NavLink>
              <NavLink
                to="/campaigns"
                className={({ isActive }) => subLinkClass(isActive)}
              >
                <Mail size={13} />
                <span>Campagnes</span>
              </NavLink>
              <NavLink
                to="/forums"
                end={false}
                className={({ isActive }) => subLinkClass(isActive)}
              >
                <MessageCircle size={13} />
                <span>Forum</span>
              </NavLink>
            </div>
          )}
        </div>

        {/* Analyses */}
        <div className="pt-1">
          <GroupToggle
            label="Analyses"
            icon={TrendingUp}
            open={analysesOpen}
            onToggle={() => {
              setAnalysesOpen((v) => !v);
            }}
          />
          {analysesOpen && (
            <div className="space-y-0.5 mt-0.5">
              <NavLink
                to="/analytics"
                className={({ isActive }) => subLinkClass(isActive)}
              >
                <BarChart2 size={13} />
                <span>Analytiques</span>
              </NavLink>
              <NavLink
                to="/ai-assistant"
                className={({ isActive }) => subLinkClass(isActive)}
              >
                <Bot size={13} />
                <span>IA Assistant</span>
              </NavLink>
            </div>
          )}
        </div>

        {/* Système */}
        <div className="pt-1">
          <GroupToggle
            label="Système"
            icon={Lock}
            open={systemeOpen}
            onToggle={() => {
              setSystemeOpen((v) => !v);
            }}
          />
          {systemeOpen && (
            <div className="space-y-0.5 mt-0.5">
              <NavLink
                to="/gdpr"
                className={({ isActive }) => subLinkClass(isActive)}
              >
                <ShieldCheck size={13} />
                <span>DSR Queue</span>
              </NavLink>
              <NavLink
                to="/audit"
                className={({ isActive }) => subLinkClass(isActive)}
              >
                <ScrollText size={13} />
                <span>Audit Log</span>
              </NavLink>
              <NavLink
                to="/settings"
                className={({ isActive }) => subLinkClass(isActive)}
              >
                <Settings size={13} />
                <span>Paramètres</span>
              </NavLink>
            </div>
          )}
        </div>

        {/* Espace Formateur */}
        <div className="pt-1">
          <GroupToggle
            label="Formateur"
            icon={GraduationCap}
            open={formateurOpen}
            onToggle={() => {
              setFormateurOpen((v) => !v);
            }}
          />
          {formateurOpen && (
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
                <span>Analytiques cours</span>
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
      </nav>

      {/* Notifications */}
      <NotificationBell />

      {/* User */}
      <div className="px-3 py-4 border-t border-white/10 shrink-0">
        <div className="px-3 mb-2">
          <p className="text-xs text-white/80 font-medium truncate">
            {user?.firstName} {user?.lastName}
          </p>
          <p className="text-xs text-white/60 truncate">{user?.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 text-xs font-semibold uppercase tracking-widest text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
