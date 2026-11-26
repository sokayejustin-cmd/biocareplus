import { useEffect, useRef } from "react";

// Pictogrammes médicaux qui dérivent lentement en arrière-plan.
// [type, position horizontale %, taille px, durée s, délai s]
const PARTICLES = [
  ["cross", 6, 26, 26, 0],
  ["ring", 14, 18, 32, -8],
  ["cross", 24, 16, 28, -16],
  ["dot", 33, 10, 22, -4],
  ["cross", 45, 22, 34, -20],
  ["ring", 55, 26, 30, -12],
  ["dot", 63, 12, 24, -2],
  ["cross", 72, 18, 27, -10],
  ["ring", 81, 14, 33, -22],
  ["cross", 90, 28, 31, -6],
  ["dot", 96, 9, 25, -14],
];

/**
 * Fond animé commun à toutes les pages : aurores colorées, grille de points,
 * pictogrammes médicaux flottants, tracé ECG et halo qui suit la souris.
 * Purement décoratif, placé derrière le contenu (aria-hidden, sans clic).
 */
export default function AmbientBackground() {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
    let frame = 0;
    const onMove = (e) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        node.style.setProperty("--spot-tx", `${e.clientX}px`);
        node.style.setProperty("--spot-ty", `${e.clientY}px`);
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <div className="ambient" ref={ref} aria-hidden="true">
      <div className="aurora aurora-1" />
      <div className="aurora aurora-2" />
      <div className="aurora aurora-3" />
      <div className="aurora aurora-4" />
      <div className="ambient-grid" />
      <div className="ambient-spot" />

      {PARTICLES.map(([kind, left, size, duration, delay], i) => (
        <span
          key={i}
          className={`particle particle-${kind}`}
          style={{
            left: `${left}%`,
            width: size,
            height: size,
            animationDuration: `${duration}s`,
            animationDelay: `${delay}s`,
          }}
        />
      ))}

      <svg className="ambient-ecg" viewBox="0 0 1200 120" preserveAspectRatio="none">
        <defs>
          <linearGradient id="ambient-ecg-g" x1="0" x2="1">
            <stop offset="0" stopColor="#1e7b34" stopOpacity="0" />
            <stop offset=".3" stopColor="#1e7b34" />
            <stop offset=".7" stopColor="#3aa935" />
            <stop offset="1" stopColor="#3aa935" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0 70 H260 L280 70 L295 40 L310 100 L325 20 L342 92 L356 70 H620 L640 70 L655 45 L670 96 L685 28 L700 88 L714 70 H980 L1000 70 L1015 42 L1030 98 L1045 24 L1062 90 L1076 70 H1200"
          fill="none"
          stroke="url(#ambient-ecg-g)"
          pathLength="1000"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
