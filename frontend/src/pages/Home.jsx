import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";

export default function Home() {
  const [info, setInfo] = useState(null);

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
          <img src="/logo.svg" alt="logo" />
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
        <div className="card">
          <svg viewBox="0 0 400 260" role="img" aria-label="Illustration médicale">
            <rect width="400" height="260" rx="18" fill="#e8f4fb" />
            <circle cx="200" cy="118" r="54" fill="#0b5f8a" />
            <rect x="186" y="78" width="28" height="80" rx="6" fill="#fff" />
            <rect x="160" y="104" width="80" height="28" rx="6" fill="#fff" />
            <rect x="40" y="190" width="320" height="28" rx="8" fill="#1b8a6b" opacity=".35" />
          </svg>
          <p style={{ color: "var(--muted)" }}>
            Accueil · Consultations · Suivi infirmier · Ordonnances
          </p>
        </div>
      </section>
      <section className="section">
        <h2>Services proposés</h2>
        <div className="cards">
          {[
            ["Médecine générale", "Consultations, prévention et suivi au long cours."],
            ["Spécialités", "Cardiologie, pédiatrie, dermatologie et plus."],
            ["Parcours patient", "Rendez-vous, bons de consultation, dossiers."],
            ["Ordonnances", "Prescriptions claires, imprimables au format PDF."],
          ].map(([t, d]) => (
            <article className="card" key={t}>
              <h3>{t}</h3>
              <p>{d}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="section" style={{ background: "#fff" }}>
        <h2>Nos professionnels</h2>
        <div className="cards">
          {(info?.professionals || []).map((p) => (
            <article className="card" key={p.id}>
              <h3>Dr {p.name}</h3>
              <span className="badge">{p.specialty}</span>
              <p>{p.bio}</p>
            </article>
          ))}
          {!info?.professionals?.length && (
            <p>L’équipe sera affichée une fois le serveur démarré.</p>
          )}
        </div>
      </section>
      <section className="section">
        <h2>Pourquoi BIO CARE PLUS ?</h2>
        <div className="cards">
          <article className="card">
            <h3>Sécurité</h3>
            <p>Accès par rôle, mots de passe hashés, API authentifiée JWT.</p>
          </article>
          <article className="card">
            <h3>Clarté</h3>
            <p>Un dossier unique par patient, un calendrier par praticien.</p>
          </article>
          <article className="card">
            <h3>Proximité</h3>
            <p>Une équipe disponible, un accueil humain, un suivi continu.</p>
          </article>
        </div>
      </section>
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
