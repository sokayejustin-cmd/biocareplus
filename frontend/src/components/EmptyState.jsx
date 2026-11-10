"use client";

import { lazy, Suspense } from "react";
import { useReducedMotion } from "motion/react";

const MedicalLottiePlayer = lazy(() => import("./MedicalLottiePlayer.jsx"));

export function MedicalIllustration({ variant = "records" }) {
  const palettes = {
    activity: ["#1b8a6b", "#e6f6f0"],
    appointments: ["#0b5f8a", "#e8f4f8"],
    calendar: ["#c27a1b", "#fff3df"],
    patients: ["#168a70", "#e6f6f0"],
    prescriptions: ["#a84d63", "#fcebed"],
    records: ["#0b5f8a", "#e8f4f8"],
    team: ["#168a70", "#e6f6f0"],
    tickets: ["#9b6b16", "#fff3df"],
  };
  const [accent, wash] = palettes[variant] || palettes.records;

  return (
    <svg viewBox="0 0 220 140" focusable="false">
      <rect x="4" y="4" width="212" height="132" rx="28" fill={wash} />
      <rect
        x="70"
        y="20"
        width="80"
        height="100"
        rx="13"
        fill="#fff"
        stroke="#cfe0e8"
        strokeWidth="3"
      />
      <path d="M89 51h42m-42 12h42m-42 12h26" stroke="#bfd3dc" strokeWidth="4" />
      <path d="M110 91v19m-9-9h18" stroke={accent} strokeWidth="4" />
      <circle cx="158" cy="91" r="14" fill="#fff" stroke={accent} strokeWidth="3" />
      <path d="m151 91 5 5 9-11" fill="none" stroke={accent} strokeWidth="3" />
    </svg>
  );
}

export function MedicalLottie({ variant = "records", className = "" }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className={className} aria-hidden="true">
      {prefersReducedMotion ? (
        <MedicalIllustration variant={variant} />
      ) : (
        <Suspense fallback={<MedicalIllustration variant={variant} />}>
          <MedicalLottiePlayer variant={variant} />
        </Suspense>
      )}
    </div>
  );
}

export default function EmptyState({
  title,
  description,
  variant = "records",
  compact = false,
  actionLabel,
  onAction,
}) {
  return (
    <div
      className={`empty-state${compact ? " empty-state--compact" : ""}`}
      role="status"
    >
      <MedicalLottie
        variant={variant}
        className="empty-state__illustration"
      />
      <div className="empty-state__content">
        <h3>{title}</h3>
        <p>{description}</p>
        {actionLabel && onAction && (
          <button
            type="button"
            className="btn empty-state__action"
            onClick={onAction}
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
