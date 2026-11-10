"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { motionTokens } from "./motion-tokens.js";

export default function AnimatedToast({ toast }) {
  const prefersReducedMotion = useReducedMotion();
  const reduceMotion = Boolean(prefersReducedMotion);

  return (
    <AnimatePresence initial={false}>
      {toast && (
        <motion.div
          key={`${toast.type}-${toast.message}`}
          role={toast.type === "error" ? "alert" : "status"}
          aria-live={toast.type === "error" ? "assertive" : "polite"}
          className={`toast ${toast.type}`}
          initial={
            reduceMotion
              ? { opacity: 0 }
              : { opacity: 0, y: motionTokens.distance.sm }
          }
          animate={{ opacity: 1, y: 0 }}
          exit={
            reduceMotion
              ? { opacity: 0 }
              : { opacity: 0, y: motionTokens.distance.sm }
          }
          transition={{
            duration: reduceMotion
              ? motionTokens.duration.instant
              : motionTokens.duration.fast,
            ease: motionTokens.easing.smooth,
          }}
        >
          {toast.message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
