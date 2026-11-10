"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { motionTokens } from "./motion-tokens.js";

export default function RouteFrame({ pathname, children }) {
  const prefersReducedMotion = useReducedMotion();
  const reduceMotion = Boolean(prefersReducedMotion);

  const initial = reduceMotion
    ? { opacity: 1 }
    : { opacity: 0, y: motionTokens.distance.xs };
  const exit = reduceMotion
    ? { opacity: 0 }
    : { opacity: 0, y: -motionTokens.distance.xs };

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={initial}
        animate={{ opacity: 1, y: 0 }}
        exit={exit}
        transition={{
          duration: reduceMotion
            ? motionTokens.duration.instant
            : motionTokens.duration.fast,
          ease: motionTokens.easing.smooth,
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
