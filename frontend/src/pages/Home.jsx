"use client";

import { lazy, Suspense, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  ClipboardCheck,
  FileText,
  HeartHandshake,
  HeartPulse,
  ShieldCheck,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { api } from "../api.js";
import { motionTokens } from "../motion/motion-tokens.js";

const MedicalScene = lazy(() => import("../components/MedicalScene.jsx"));

export default function Home() {
  const [info, setInfo] = useState(null);
  const prefersReducedMotion = useReducedMotion();
  const revealProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: motionTokens.distance.md },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true },
        transition: {
          duration: motionTokens.duration.normal,
          ease: motionTokens.easing.smooth,
        },
      };

  useEffect(() => {
    api("/public/clinic/")
      .then(setInfo)
      .catch(() =>
        setInfo({
          name: "BIO CARE PLUS",
          address: "12 Avenue de la Santé, 75013 Paris",
          phone: "+33 1 23 45 67 89",
          email: "contact@biocareplus.fr",
          professionals: [],
        })
      );
  }, []);

  return (
    <div>
      <header className="site-header">
        <div className="brand">
          <img src="/logo.svg" alt="" />
          BIO CARE PLUS
        </div>
        <Link className="btn" to="/login">
          Se connecter
        </Link>
      </header>
      <section className="hero">
        <div>
          <h1>Une médecine humaine, moderne et accessible.</h1>
          <p>
            BIO CARE PLUS est un cabinet médical pluridisciplinaire. Nous
            centralisons vos rendez-vous, dossiers et ordonnances pour un suivi
            clair, sûr et continu.
          </p>
          <Link className="btn green" to="/login">
            Accéder à l’espace sécurisé
          </Link>
        </div>
        <div className="card medical-scene-card">
          <Suspense
            fallback={
              <div
                className="medical-scene scene-placeholder"
                role="img"
                aria-label="Illustration médicale en cours de chargement"
              >
                <span aria-hidden="true">+</span>
              </div>
            }
          >
            <MedicalScene />
          </Suspense>
          <p style={{ color: "var(--muted)" }}>
            Accueil · Consultations · Suivi infirmier · Ordonnances
          </p>
        </div>
      </section>
      <motion.section className="section" {...revealProps}>
        <h2>Services proposés</h2>
        <div className="cards">
          {[
            {
              title: "Médecine générale",
              description: "Consultations, prévention et suivi au long cours.",
              icon: Stethoscope,
            },
            {
              title: "Spécialités",
              description: "Cardiologie, pédiatrie, dermatologie et plus.",
              icon: HeartPulse,
            },
            {
              title: "Parcours patient",
              description: "Rendez-vous, bons de consultation, dossiers.",
              icon: CalendarDays,
            },
            {
              title: "Ordonnances",
              description: "Prescriptions claires, imprimables au format PDF.",
              icon: FileText,
            },
          ].map(({ title, description, icon: Icon }) => (
            <article className="card home-card" key={title}>
              <span className="home-card-icon" aria-hidden="true">
                <Icon size={22} strokeWidth={1.8} />
              </span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </motion.section>
      <motion.section className="section" style={{ background: "#fff" }} {...revealProps}>
        <h2>Nos professionnels</h2>
        <div className="cards">
          {(info?.professionals || []).map((p) => (
            <article className="card home-card" key={p.id}>
              <span className="home-card-icon home-card-icon--professional" aria-hidden="true">
                <UserRound size={22} strokeWidth={1.8} />
              </span>
              <h3>Dr {p.name}</h3>
              <span className="badge">{p.specialty}</span>
              <p>{p.bio}</p>
            </article>
          ))}
          {!info?.professionals?.length && (
            <p>L’équipe sera affichée une fois le serveur démarré.</p>
          )}
        </div>
      </motion.section>
      <motion.section className="section" {...revealProps}>
        <h2>Pourquoi BIO CARE PLUS ?</h2>
        <div className="cards">
          <article className="card home-card">
            <span className="home-card-icon" aria-hidden="true">
              <ShieldCheck size={22} strokeWidth={1.8} />
            </span>
            <h3>Sécurité</h3>
            <p>Accès par rôle, mots de passe hashés, API authentifiée JWT.</p>
          </article>
          <article className="card home-card">
            <span className="home-card-icon" aria-hidden="true">
              <ClipboardCheck size={22} strokeWidth={1.8} />
            </span>
            <h3>Clarté</h3>
            <p>Un dossier unique par patient, un calendrier par praticien.</p>
          </article>
          <article className="card home-card">
            <span className="home-card-icon" aria-hidden="true">
              <HeartHandshake size={22} strokeWidth={1.8} />
            </span>
            <h3>Proximité</h3>
            <p>Une équipe disponible, un accueil humain, un suivi continu.</p>
          </article>
        </div>
      </motion.section>
      <footer className="site-footer">
        <div>
          <strong>{info?.name || "BIO CARE PLUS"}</strong>
          <div>{info?.address}</div>
        </div>
        <div>
          <div>Tél. {info?.phone}</div>
          <div>{info?.email}</div>
        </div>
      </footer>
    </div>
  );
}
