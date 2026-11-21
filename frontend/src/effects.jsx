import { useEffect, useRef, useState } from "react";

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Fait apparaître son contenu en fondu quand il entre dans l'écran.
 * `delay` (ms) permet un effet de cascade entre éléments voisins.
 */
export function Reveal({ as: Tag = "div", delay = 0, className = "", children, ...rest }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || reducedMotion() || !("IntersectionObserver" in window)) {
      setShown(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`reveal ${shown ? "is-visible" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Compteur animé de 0 jusqu'à `value` (les valeurs non numériques sont affichées telles quelles). */
export function CountUp({ value, duration = 900 }) {
  const target = Number(value);
  const numeric = Number.isFinite(target);
  const [shown, setShown] = useState(numeric ? 0 : value);

  useEffect(() => {
    if (!numeric) {
      setShown(value);
      return undefined;
    }
    if (reducedMotion() || target === 0) {
      setShown(target);
      return undefined;
    }
    let frame;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, numeric, value, duration]);

  return <>{numeric ? shown.toLocaleString("fr-FR") : shown}</>;
}

/** Vrai dès que la page a défilé de plus de `offset` pixels. */
export function useScrolled(offset = 8) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > offset);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [offset]);
  return scrolled;
}

/**
 * Inclinaison 3D au survol de la souris (effet « carte holographique »).
 * Un seul écouteur délégué sur le document : tous les éléments correspondant à
 * `selector` (présents ou ajoutés plus tard) s'inclinent vers le curseur, avec un
 * reflet lumineux qui suit la souris. Désactivé au tactile et en mouvement réduit.
 * Retourne une fonction de nettoyage.
 */
export function installTilt3D(selector, { max = 9 } = {}) {
  if (typeof window === "undefined" || reducedMotion()) return () => {};
  let current = null;
  let frame = 0;

  const reset = (el) => {
    el.classList.remove("is-tilting");
    el.style.removeProperty("--rx");
    el.style.removeProperty("--ry");
  };

  const onMove = (e) => {
    if (e.pointerType && e.pointerType !== "mouse") return;
    const el = e.target instanceof Element ? e.target.closest(selector) : null;
    if (current && current !== el) reset(current);
    current = el;
    if (!el) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width; // 0 → 1
      const py = (e.clientY - r.top) / r.height;
      // Les grands blocs s'inclinent moins pour rester lisibles.
      const k = Math.min(1, 420 / Math.max(r.width, r.height));
      el.style.setProperty("--ry", `${((px - 0.5) * 2 * max * k).toFixed(2)}deg`);
      el.style.setProperty("--rx", `${((0.5 - py) * 2 * max * k).toFixed(2)}deg`);
      el.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
      el.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
      el.classList.add("is-tilting");
    });
  };

  const onLeave = () => {
    cancelAnimationFrame(frame);
    if (current) reset(current);
    current = null;
  };

  document.addEventListener("pointermove", onMove, { passive: true });
  document.documentElement.addEventListener("pointerleave", onLeave);
  window.addEventListener("blur", onLeave);
  return () => {
    onLeave();
    document.removeEventListener("pointermove", onMove);
    document.documentElement.removeEventListener("pointerleave", onLeave);
    window.removeEventListener("blur", onLeave);
  };
}

/** Double hélice d'ADN en 3D (CSS pur), purement décorative. */
export function Helix({ rungs = 14, className = "" }) {
  return (
    <div className={`helix ${className}`} aria-hidden="true">
      <div className="helix-spin">
        {Array.from({ length: rungs }, (_, i) => (
          <span className="helix-rung" key={i} style={{ "--i": i }} />
        ))}
      </div>
    </div>
  );
}
