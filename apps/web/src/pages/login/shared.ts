import { useEffect, useRef, useState, type RefObject } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion.js";

/** Fait tourner une liste de mots ; reste sur le premier en reduced-motion. */
export function useCycleWords(
  words: readonly string[],
  intervalMs: number,
): string {
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % words.length);
    }, intervalMs);
    return () => {
      window.clearInterval(id);
    };
  }, [reduced, words, intervalMs]);

  return words[index] ?? "";
}

/**
 * Révélation au défilement : `visible` passe à true (une seule fois)
 * quand l'élément entre dans le viewport.
 */
export function useReveal<T extends HTMLElement>(): {
  ref: RefObject<T>;
  visible: boolean;
} {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (element === null) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);

  return { ref, visible };
}
