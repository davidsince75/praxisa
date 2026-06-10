import { Sidebar } from "./Sidebar.js";
import { SessionExpiryBanner } from "./SessionExpiryBanner.js";

interface ShellProps {
  children: React.ReactNode;
}

export function Shell({ children }: ShellProps) {
  return (
    <div className="min-h-screen bg-cream">
      <a href="#contenu" className="skip-link">
        Aller au contenu principal
      </a>
      <Sidebar />
      <main
        id="contenu"
        tabIndex={-1}
        className="ml-56 min-h-screen outline-none"
      >
        <div className="max-w-6xl mx-auto px-8 py-8">{children}</div>
      </main>
      <SessionExpiryBanner />
    </div>
  );
}
