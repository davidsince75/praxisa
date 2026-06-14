import { LearnSidebar } from "./LearnSidebar.js";
import { SessionExpiryBanner } from "./SessionExpiryBanner.js";

interface LearnShellProps {
  children: React.ReactNode;
}

export function LearnShell({ children }: LearnShellProps) {
  return (
    <div className="min-h-screen bg-cream">
      <a href="#contenu" className="skip-link">
        Aller au contenu principal
      </a>
      <LearnSidebar />
      <main
        id="contenu"
        tabIndex={-1}
        className="ml-56 min-h-screen outline-none print:ml-0"
      >
        <div className="max-w-6xl mx-auto px-8 py-8">{children}</div>
      </main>
      <SessionExpiryBanner />
    </div>
  );
}
