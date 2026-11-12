import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, unwrap } from "../api.js";
import { useAuth } from "../auth.jsx";

const STAT_CARDS = [
  { key: "users_total", icon: "👥", label: "Utilisateurs" },
  { key: "doctors_total", icon: "👨‍⚕️", label: "Docteurs" },
  { key: "nurses_total", icon: "👩‍⚕️", label: "Infirmiers" },
  { key: "appointments_total", icon: "📅", label: "Rendez-vous" },
];

const MODULES = [
  { icon: "👥", title: "Utilisateurs", text: "Gérer les comptes et les accès des utilisateurs.", action: "Gérer les utilisateurs", to: "/app/users", countKey: "users_total" },
  { icon: "👨‍⚕️", title: "Docteurs", text: "Ajouter, modifier et gérer les médecins.", action: "Gérer les docteurs", to: "/app/doctors", countKey: "doctors_total" },
  { icon: "👩‍⚕️", title: "Infirmiers", text: "Administrer les infirmiers de l'établissement.", action: "Gérer les infirmiers", to: "/app/nurses", countKey: "nurses_total" },
  { icon: "🧑‍💼", title: "Réceptionnistes", text: "Gérer les comptes des réceptionnistes.", action: "Gérer les réceptionnistes", to: "/app/receptionists", countKey: "receptionists_total" },
  { icon: "🏥", title: "Spécialités", text: "Administrer les spécialités médicales.", action: "Gérer les spécialités", to: "/app/specialties" },
  { icon: "📊", title: "Statistiques", text: "Consulter les statistiques générales du système.", action: "Voir les statistiques", to: "/app/stats" },
];

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/stats/analytics/")
      .then(setStats)
      .catch(() => setError("Impossible de charger les statistiques."));

    api("/appointments/")
      .then((data) => {
        const latest = unwrap(data)
          .slice()
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 5);
        setActivity(latest);
      })
      .catch(() => setActivity([]));
  }, []);

  const value = (key) => (stats ? stats[key] ?? 0 : "…");

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <h1>Administration</h1>
          <p>Bienvenue dans l'espace administrateur de Bio Care Plus.</p>
        </div>

        <div className="admin-user">
          <strong>
            {user?.first_name} {user?.last_name}
          </strong>
          <span>Administrateur</span>
        </div>
      </div>

      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

      <div className="admin-stats">
        {STAT_CARDS.map((card) => (
          <div className="admin-card" key={card.key}>
            <div className="admin-card-icon">{card.icon}</div>
            <div>
              <span>{card.label}</span>
              <strong>{value(card.key)}</strong>
            </div>
          </div>
        ))}
      </div>

      <section className="admin-section">
        <h2>Gestion du système</h2>

        <div className="admin-grid">
          {MODULES.map((m) => (
            <div className="admin-module" key={m.to}>
              <div className="module-icon">{m.icon}</div>
              <h3>
                {m.title}
                {m.countKey && stats ? ` (${value(m.countKey)})` : ""}
              </h3>
              <p>{m.text}</p>
              <button type="button" onClick={() => navigate(m.to)}>
                {m.action}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-section">
        <h2>Activité récente</h2>

        <div className="admin-activity">
          {activity.length === 0 ? (
            <p>Aucune activité récente.</p>
          ) : (
            activity.map((a) => (
              <p key={a.id}>
                <strong>{formatDate(a.created_at)}</strong> — Rendez-vous de{" "}
                {a.patient_name} avec Dr {a.doctor_name} le {a.date} à{" "}
                {a.time?.slice(0, 5)} ({a.status_label})
              </p>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
