import { useEffect, useState } from "react";
import { getTokenRemainingMs } from "@/lib/api.js";

const WARN_BEFORE_MS = 10 * 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 1000;

/**
 * RGAA: sessions that expire must warn the user beforehand. Shows a
 * dismissible alert when fewer than 10 minutes remain on the JWT.
 */
export function SessionExpiryBanner() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    function check(): void {
      const remaining = getTokenRemainingMs();
      setVisible(
        remaining !== null && remaining > 0 && remaining <= WARN_BEFORE_MS,
      );
    }
    check();
    const timer = setInterval(check, CHECK_INTERVAL_MS);
    return () => {
      clearInterval(timer);
    };
  }, []);

  if (!visible || dismissed) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 border border-sand bg-white px-5 py-3 shadow-xl"
    >
      <p className="text-sm text-dark">
        Votre session expire dans moins de 10 minutes — enregistrez votre
        travail, puis reconnectez-vous.
      </p>
      <button
        onClick={() => {
          setDismissed(true);
        }}
        className="min-h-[44px] shrink-0 px-3 text-sm font-semibold text-teal hover:text-teal-dark"
      >
        Compris
      </button>
    </div>
  );
}
