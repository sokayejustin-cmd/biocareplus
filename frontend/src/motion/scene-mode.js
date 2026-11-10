export function resolveSceneMode({ prefersReducedMotion, webglAvailable }) {
  if (!webglAvailable) return "fallback";
  if (prefersReducedMotion) return "static";
  return "animated";
}
