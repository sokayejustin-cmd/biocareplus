import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import EmptyState, { MedicalLottie } from "../components/EmptyState.jsx";

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadStats = () => {
    setLoading(true);
    setError("");
    api("/stats/dashboard/")
      .then(setStats)
      .catch((err) => {
        console.error("Erreur chargement des indicateurs :", err);
        setError(err.message || "Impossible de charger les indicateurs.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadStats();
  }, []);

  const labels = {
    patients: "Patients",
    doctors: "Docteurs",
    nurses: "Infirmiers",
    appointments: "Rendez-vous",
    consultations: "Consultations",
    prescriptions: "Ordonnances",
    today_appointments: "RDV du jour",
    new_patients: "Nouveaux patients",
    my_appointments_today: "Mes RDV du jour",
    my_patients: "Mes patients",
    my_consultations: "Mes consultations",
    my_prescriptions: "Mes ordonnances",
    assigned_patients: "Patients assignés",
    waiting: "En attente",
    upcoming_appointments: "RDV à venir",
  };

  return (
    <div>
      <section className="dashboard-intro">
        <div>
          <h1>Tableau de bord</h1>
          <p>
            Espace {user?.role} — {user?.first_name} {user?.last_name}
          </p>
        </div>
        {stats && Object.keys(stats).length > 0 && (
          <MedicalLottie
            variant="activity"
            className="dashboard-intro__illustration"
          />
        )}
      </section>
      {loading ? (
        <p role="status">Chargement des indicateurs…</p>
      ) : error ? (
        <EmptyState
          title="Indicateurs indisponibles"
          description={error}
          variant="activity"
          actionLabel="Réessayer"
          onAction={loadStats}
        />
      ) : Object.keys(stats || {}).length === 0 ? (
        <EmptyState
          title="Aucune activité pour le moment"
          description="Les indicateurs apparaîtront ici dès que des rendez-vous ou des dossiers seront enregistrés."
          variant="activity"
        />
      ) : (
        <div className="stats">
          {Object.entries(stats).map(([k, v]) => (
            <div className="stat" key={k}>
              <b>{v}</b>
              <span>{labels[k] || k}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
