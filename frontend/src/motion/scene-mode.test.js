import test from "node:test";
import assert from "node:assert/strict";

import { resolveSceneMode } from "./scene-mode.js";

test("uses a static scene when reduced motion is preferred", () => {
  assert.equal(
    resolveSceneMode({ prefersReducedMotion: true, webglAvailable: true }),
    "static"
  );
});

test("uses the HTML fallback when WebGL is unavailable", () => {
  assert.equal(
    resolveSceneMode({ prefersReducedMotion: false, webglAvailable: false }),
    "fallback"
  );
});

test("animates the scene when motion is allowed and WebGL is available", () => {
  assert.equal(
    resolveSceneMode({ prefersReducedMotion: false, webglAvailable: true }),
    "animated"
  );
});
