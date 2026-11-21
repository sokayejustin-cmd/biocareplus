import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { CountUp } from "../effects.jsx";

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
      <div className="dash-hero">
        <h1>Bonjour {user?.first_name || user?.username}</h1>
        <p>Voici l'activité du jour — {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</p>
      </div>
      <div className="stats">
        {Object.entries(stats).map(([k, v], i) => (
          <div className="stat" key={k} style={{ animationDelay: `${i * 60}ms` }}>
            <b>
              <CountUp value={v} />
            </b>
            <span>{labels[k] || k}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
