import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { Helix, Reveal, useScrolled } from "../effects.jsx";

// Icônes au trait (24×24), couleur héritée du texte.
const ICONS = {
  stethoscope: (
    <path d="M6 3v6a5 5 0 0 0 10 0V3M6 3H4m2 0h2m8 0h-2m2 0h2M11 14v2a5 5 0 0 0 10 0v-1m0-2a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z" />
  ),
  heart: (
    <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Zm-5-8h3l1.5-3 2 6 1.5-3H17" />
  ),
  calendar: (
    <path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Zm0 3h16M8 3v4m8-4v4m-8 7h3m-3 3h6" />
  ),
  file: (
    <path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm7 0v5h5M9 13h6m-6 4h4" />
  ),
  shield: (
    <path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Zm-3 9 2 2 4-4" />
  ),
  eye: (
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
  ),
  hand: (
    <path d="M7 11V6a1.5 1.5 0 0 1 3 0v4m0-5a1.5 1.5 0 0 1 3 0v5m0-4a1.5 1.5 0 0 1 3 0v6m-9-1-1.2-1.6a1.6 1.6 0 0 0-2.6 1.9L8 18a5 5 0 0 0 4 2h1a5 5 0 0 0 5-5v-4" />
  ),
  phone: (
    <path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
  ),
};

function Icon({ name }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

const SERVICES = [
  ["stethoscope", "Médecine générale", "Consultations, prévention et suivi au long cours."],
  ["heart", "Spécialités", "Cardiologie, pédiatrie, dermatologie et plus."],
  ["calendar", "Parcours patient", "Rendez-vous, bons de consultation, dossiers."],
  ["file", "Ordonnances", "Prescriptions claires, imprimables au format PDF."],
];

const VALUES = [
  ["shield", "Sécurité", "Accès par rôle, mots de passe hashés, API authentifiée JWT."],
  ["eye", "Clarté", "Un dossier unique par patient, un calendrier par praticien."],
  ["hand", "Proximité", "Une équipe disponible, un accueil humain, un suivi continu."],
];

export default function Home() {
  const [info, setInfo] = useState(null);
  const scrolled = useScrolled();

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

  const pros = info?.professionals || [];

  return (
    <div className="home">
      <header className={`site-header ${scrolled ? "is-scrolled" : ""}`}>
        <div className="brand">
          <img src="/logo.svg" alt="" />
          BIO CARE PLUS
        </div>
        <Link className="btn" to="/login">
          Se connecter
        </Link>
      </header>

      <section className="hero">
        <div className="hero-blob hero-blob-a" aria-hidden="true" />
        <div className="hero-blob hero-blob-b" aria-hidden="true" />

        <div className="hero-text">
          <span className="eyebrow">Cabinet médical pluridisciplinaire</span>
          <h1>
            Une médecine <span className="gradient-text">humaine, moderne</span> et accessible.
          </h1>
          <p>
            BIO CARE PLUS centralise vos rendez-vous, dossiers, résultats d'analyse et
            ordonnances pour un suivi clair, sûr et continu — avec des rappels directement
            sur WhatsApp.
          </p>
          <div className="hero-actions">
            <Link className="btn green btn-lg" to="/login">
              Accéder à mon espace
            </Link>
            <a className="btn secondary btn-lg" href="#services">
              Découvrir nos services
            </a>
          </div>
          <ul className="hero-points">
            <li>Rappels de rendez-vous</li>
            <li>Résultats en ligne</li>
            <li>Ordonnances PDF</li>
          </ul>
        </div>

        <div className="hero-visual">
          <Helix className="helix-hero" />
          <div className="hero-stage">
          <div className="hero-card card">
            <svg viewBox="0 0 400 260" role="img" aria-label="Illustration médicale">
              <defs>
                <linearGradient id="hero-g" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#0b5f8a" />
                  <stop offset="1" stopColor="#1b8a6b" />
                </linearGradient>
              </defs>
              <rect width="400" height="260" rx="18" fill="#eef7fb" />
              <circle className="pulse-ring" cx="200" cy="118" r="54" fill="none" stroke="#1b8a6b" strokeWidth="3" />
              <circle className="pulse-ring delay" cx="200" cy="118" r="54" fill="none" stroke="#0b5f8a" strokeWidth="2" />
              <circle cx="200" cy="118" r="54" fill="url(#hero-g)" />
              <rect x="186" y="78" width="28" height="80" rx="6" fill="#fff" />
              <rect x="160" y="104" width="80" height="28" rx="6" fill="#fff" />
              <polyline
                className="ecg"
                points="30,214 120,214 140,214 152,190 164,236 176,200 188,214 370,214"
                fill="none"
                stroke="#1b8a6b"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="muted">Accueil · Consultations · Suivi infirmier · Ordonnances</p>
          </div>
          <div className="float-chip chip-a">
            <Icon name="calendar" /> RDV confirmé
          </div>
          <div className="float-chip chip-b">
            <Icon name="phone" /> Rappel WhatsApp envoyé
          </div>
          </div>
        </div>
      </section>

      <section className="section" id="services">
        <Reveal as="h2">Services proposés</Reveal>
        <div className="cards">
          {SERVICES.map(([icon, t, d], i) => (
            <Reveal as="article" className="card feature-card" key={t} delay={i * 90}>
              <span className="feature-icon">
                <Icon name={icon} />
              </span>
              <h3>{t}</h3>
              <p>{d}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="section section-alt">
        <Reveal as="h2">Nos professionnels</Reveal>
        <div className="cards">
          {pros.map((p, i) => (
            <Reveal as="article" className="card pro-card" key={p.id} delay={i * 90}>
              <span className="avatar" aria-hidden="true">
                {(p.name || "?").trim().charAt(0).toUpperCase()}
              </span>
              <h3>Dr {p.name}</h3>
              <span className="badge">{p.specialty}</span>
              <p>{p.bio}</p>
            </Reveal>
          ))}
          {!pros.length && <p className="muted">L’équipe sera affichée une fois le serveur démarré.</p>}
        </div>
      </section>

      <section className="section">
        <Reveal as="h2">Pourquoi BIO CARE PLUS ?</Reveal>
        <div className="cards">
          {VALUES.map(([icon, t, d], i) => (
            <Reveal as="article" className="card feature-card" key={t} delay={i * 90}>
              <span className="feature-icon">
                <Icon name={icon} />
              </span>
              <h3>{t}</h3>
              <p>{d}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <Reveal as="section" className="cta-band">
        <div>
          <h2>Votre santé, suivie en toute simplicité.</h2>
          <p>Connectez-vous pour consulter vos rendez-vous et vos résultats.</p>
        </div>
        <Link className="btn btn-lg btn-light" to="/login">
          Se connecter
        </Link>
      </Reveal>

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
