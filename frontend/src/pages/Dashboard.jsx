import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({});

  useEffect(() => {
    api("/stats/dashboard/").then(setStats).catch(() => setStats({}));
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
      <h1>Tableau de bord</h1>
      <p style={{ color: "var(--muted)" }}>
        Espace {user?.role} — {user?.first_name} {user?.last_name}
      </p>
      <div className="stats">
        {Object.entries(stats).map(([k, v]) => (
          <div className="stat" key={k}>
            <b>{v}</b>
            <span>{labels[k] || k}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
