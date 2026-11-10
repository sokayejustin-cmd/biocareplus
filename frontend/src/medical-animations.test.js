import assert from "node:assert/strict";
import test from "node:test";
import { medicalAnimations } from "./animations/medicalAnimations.js";

test("medical Lottie variants are self-contained and use vector layers", () => {
  for (const [variant, animation] of Object.entries(medicalAnimations)) {
    assert.equal(animation.w, 220, `${variant} animation width`);
    assert.equal(animation.h, 140, `${variant} animation height`);
    assert.equal(animation.fr, 24, `${variant} frame rate`);
    assert.equal(animation.op, 72, `${variant} duration`);
    assert.equal(animation.assets.length, 0, `${variant} should have no remote assets`);
    assert.ok(animation.layers.length > 0, `${variant} should contain vector layers`);
    assert.ok(
      animation.layers.every((layer) => layer.ty === 4 && layer.shapes.length > 0),
      `${variant} should contain shape layers`
    );
  }
});

test("medical Lottie variants provide their own contextual illustrations", () => {
  assert.notDeepEqual(
    medicalAnimations.activity.layers[1].shapes,
    medicalAnimations.calendar.layers[1].shapes
  );
  assert.notDeepEqual(
    medicalAnimations.patients.layers[1].shapes,
    medicalAnimations.records.layers[1].shapes
  );
});

test("medical Lottie rectangles use animated-property data for corner radius", () => {
  const rectangles = Object.values(medicalAnimations).flatMap((animation) =>
    animation.layers.flatMap((layer) =>
      layer.shapes.flatMap((shape) =>
        shape.it.filter((item) => item.ty === "rc")
      )
    )
  );

  assert.ok(rectangles.length > 0);
  assert.ok(
    rectangles.every(
      (rectangle) =>
        rectangle.r &&
        rectangle.r.a === 0 &&
        typeof rectangle.r.k === "number"
    )
  );
});
