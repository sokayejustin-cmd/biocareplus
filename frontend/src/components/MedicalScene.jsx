"use client";

import { useEffect, useRef, useState } from "react";
import {
  BoxGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  TorusGeometry,
  WebGLRenderer,
} from "three";
import { useReducedMotion } from "motion/react";
import { resolveSceneMode } from "../motion/scene-mode.js";

function webglAvailable() {
  return (
    typeof WebGLRenderingContext !== "undefined" ||
    typeof WebGL2RenderingContext !== "undefined"
  );
}

function StaticFallback() {
  return (
    <svg
      className="medical-scene-fallback"
      viewBox="0 0 400 320"
      aria-hidden="true"
    >
      <circle cx="200" cy="160" r="118" fill="#e4f2f5" />
      <circle
        cx="200"
        cy="160"
        r="92"
        fill="none"
        stroke="#85b8c5"
        strokeWidth="2"
      />
      <rect x="177" y="106" width="46" height="108" rx="12" fill="#0b5f8a" />
      <rect x="146" y="137" width="108" height="46" rx="12" fill="#0b5f8a" />
      <circle cx="290" cy="91" r="12" fill="#1b8a6b" />
    </svg>
  );
}

export default function MedicalScene() {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const prefersReducedMotion = useReducedMotion();
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return undefined;

    const mode = resolveSceneMode({
      prefersReducedMotion: Boolean(prefersReducedMotion),
      webglAvailable: webglAvailable(),
    });

    if (mode === "fallback") {
      setFallback(true);
      return undefined;
    }

    let renderer;
    try {
      renderer = new WebGLRenderer({
        canvas,
        alpha: true,
        antialias: false,
        powerPreference: "low-power",
      });
    } catch (error) {
      console.warn("La scène 3D est désactivée : WebGL est indisponible.", error);
      setFallback(true);
      return undefined;
    }

    setFallback(false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

    const scene = new Scene();
    const camera = new PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0, 7);

    scene.add(new HemisphereLight(0xeaf7fb, 0x7aa4b2, 2.2));

    const keyLight = new DirectionalLight(0xffffff, 3);
    keyLight.position.set(-3, 4, 6);
    scene.add(keyLight);

    const subject = new Group();
    scene.add(subject);

    const cross = new Group();
    subject.add(cross);
    const crossMaterial = new MeshStandardMaterial({
      color: 0x0b5f8a,
      roughness: 0.28,
      metalness: 0.12,
    });
    const verticalBar = new Mesh(
      new BoxGeometry(0.82, 2.35, 0.5),
      crossMaterial
    );
    const horizontalBar = new Mesh(
      new BoxGeometry(2.35, 0.82, 0.5),
      crossMaterial
    );
    cross.add(verticalBar, horizontalBar);
    cross.rotation.set(0.08, -0.22, -0.08);

    const ringMaterial = new MeshStandardMaterial({
      color: 0x62a897,
      roughness: 0.36,
      metalness: 0.45,
    });
    const orbit = new Mesh(
      new TorusGeometry(2.15, 0.035, 8, 120),
      ringMaterial
    );
    orbit.rotation.set(0.95, 0.12, -0.2);
    subject.add(orbit);

    const innerRing = new Mesh(
      new TorusGeometry(1.7, 0.018, 6, 100),
      new MeshStandardMaterial({
        color: 0x8dbdca,
        roughness: 0.4,
        metalness: 0.3,
      })
    );
    innerRing.rotation.set(1.15, -0.2, 0.45);
    subject.add(innerRing);

    const accent = new Mesh(
      new SphereGeometry(0.13, 20, 16),
      new MeshStandardMaterial({
        color: 0x1b8a6b,
        roughness: 0.25,
        metalness: 0.1,
      })
    );
    accent.position.set(1.62, 1.25, 0.05);
    subject.add(accent);

    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      renderer.render(scene, camera);
    };

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(resize);
    if (resizeObserver) {
      resizeObserver.observe(container);
    } else {
      window.addEventListener("resize", resize);
    }
    resize();

    let frameId = null;
    let elapsed = 0;
    let previousTime = 0;
    const renderFrame = (time) => {
      frameId = null;
      if (document.visibilityState === "hidden") return;
      if (previousTime) elapsed += Math.min((time - previousTime) / 1000, 0.05);
      previousTime = time;
      subject.rotation.y = Math.sin(elapsed * 0.32) * 0.16;
      subject.rotation.x = Math.cos(elapsed * 0.24) * 0.045;
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(renderFrame);
    };
    const startAnimation = () => {
      if (mode !== "animated" || frameId !== null) return;
      previousTime = 0;
      frameId = window.requestAnimationFrame(renderFrame);
    };
    const stopAnimation = () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      frameId = null;
      previousTime = 0;
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") stopAnimation();
      else startAnimation();
    };

    if (mode === "animated") {
      document.addEventListener("visibilitychange", onVisibilityChange);
      startAnimation();
    }

    return () => {
      stopAnimation();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", resize);
      scene.traverse((object) => {
        if (object instanceof Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
    };
  }, [prefersReducedMotion]);

  return (
    <div
      ref={containerRef}
      className="medical-scene"
      role="img"
      aria-label="Illustration 3D d'une croix médicale entourée d'orbites"
    >
      {fallback ? (
        <StaticFallback />
      ) : (
        <canvas ref={canvasRef} aria-hidden="true" />
      )}
    </div>
  );
}
