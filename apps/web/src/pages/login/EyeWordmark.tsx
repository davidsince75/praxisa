import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils.js";
import { usePrefersReducedMotion } from "@/pages/login/shared.js";

interface EyeWordmarkProps {
  /** « ink » sur fond clair, « paper » sur fond sombre. */
  tone?: "ink" | "paper";
  className?: string;
}

/**
 * Mot-symbole « Psychostudy » : le « o » est un œil qui suit doucement
 * le curseur et cligne de temps en temps. Tout est désactivé quand
 * l'utilisateur préfère réduire les animations.
 */
export function EyeWordmark({ tone = "ink", className }: EyeWordmarkProps) {
  const reduced = usePrefersReducedMotion();
  const eyeRef = useRef<SVGSVGElement>(null);
  const pupilRef = useRef<SVGGElement>(null);

  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    const onMove = (event: MouseEvent) => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const eye = eyeRef.current;
        const pupil = pupilRef.current;
        if (eye === null || pupil === null) return;
        const box = eye.getBoundingClientRect();
        const dx = event.clientX - (box.left + box.width / 2);
        const dy = event.clientY - (box.top + box.height / 2);
        const distance = Math.hypot(dx, dy);
        if (distance < 1) return;
        const reach = Math.min(3.4, distance / 60);
        const x = ((dx / distance) * reach).toFixed(2);
        const y = ((dy / distance) * reach).toFixed(2);
        pupil.style.transform = `translate(${x}px, ${y}px)`;
      });
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.cancelAnimationFrame(frame);
    };
  }, [reduced]);

  const ink = tone === "ink" ? "#1A1A18" : "#F2EEE8";
  const lid = tone === "ink" ? "#F2EEE8" : "#1A1A18";
  const iris = tone === "ink" ? "#4A6F96" : "#8FB0D4";

  return (
    <span className={cn("font-display tracking-tight", className)}>
      <span className="sr-only">Psychostudy</span>
      <span aria-hidden="true" className="whitespace-nowrap">
        Psych
        <svg
          ref={eyeRef}
          viewBox="0 0 24 24"
          className="mx-[0.03em] inline-block translate-y-[0.04em]"
          style={{ width: "0.6em", height: "0.6em" }}
        >
          <circle
            cx="12"
            cy="12"
            r="9.5"
            fill="none"
            stroke={iris}
            strokeWidth="2.8"
          />
          <g ref={pupilRef}>
            <circle cx="12" cy="12" r="4.4" fill={ink} />
            <circle cx="13.7" cy="10.3" r="1.2" fill={iris} />
          </g>
          {!reduced && (
            <circle
              cx="12"
              cy="12"
              r="11"
              fill={lid}
              className="origin-center animate-blink [transform-box:fill-box]"
            />
          )}
        </svg>
        study
      </span>
    </span>
  );
}
