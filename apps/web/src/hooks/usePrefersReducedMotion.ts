import { useEffect, useState } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Suit la préférence utilisateur « réduire les animations » (RGAA).
 * Les animations pilotées en JS (œil du logo, mots qui tournent,
 * morphing SMIL) doivent la respecter elles-mêmes — le CSS global
 * ne neutralise que les keyframes.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    const onChange = (event: MediaQueryListEvent) => {
      setReduced(event.matches);
    };
    mediaQuery.addEventListener("change", onChange);
    return () => {
      mediaQuery.removeEventListener("change", onChange);
    };
  }, []);

  return reduced;
}
