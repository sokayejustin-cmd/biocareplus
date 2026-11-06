import { useEffect, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api } from "../api.js";

const STATUS_LABELS = {
  scheduled: "Programmé",
  confirmed: "Confirmé",
  waiting: "En attente",
  completed: "Terminé",
  cancelled: "Annulé",
};
const STATUS_COLORS = {
  scheduled: "#3b82c4",
  confirmed: "#1f9d74",
  waiting: "#e0a030",
  completed: "#5b6b7a",
  cancelled: "#d0463b",
};

const TOTALS = [
  ["patients_total", "Patients"],
  ["doctors_total", "Docteurs"],
  ["nurses_total", "Infirmiers"],
  ["receptionists_total", "Réceptionnistes"],
  ["appointments_total", "Rendez-vous"],
  ["consultations_total", "Consultations"],
  ["prescriptions_total", "Ordonnances"],
];

export default function Statistics() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/stats/analytics/").then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <p>Erreur : {error}</p>;
  if (!data) return <p>Chargement...</p>;

  const byMonth = data.patients_by_month.map((r) => ({
    month: new Date(r.month).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
    total: r.total,
  }));
  const byDoctor = data.consultations_by_doctor.map((r) => ({
    name: `Dr ${r.doctor__user__first_name} ${r.doctor__user__last_name}`.trim(),
    total: r.total,
  }));
  const byStatus = data.appointments_by_status.map((r) => ({
    status: r.status,
    name: STATUS_LABELS[r.status] || r.status,
    value: r.total,
  }));

  return (
    <div>
      <h1>Statistiques</h1>
      <div className="stats">
        {TOTALS.map(([k, label]) => (
          <div className="stat" key={k}>
            <b>{data[k] ?? 0}</b>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Nouveaux patients par mois</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byMonth}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="total" name="Patients" fill="#1f9d74" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3>Rendez-vous par statut</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={byStatus} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                {byStatus.map((s) => (
                  <Cell key={s.status} fill={STATUS_COLORS[s.status] || "#999"} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h3>Consultations par docteur</h3>
        <ResponsiveContainer width="100%" height={Math.max(160, byDoctor.length * 40)}>
          <BarChart data={byDoctor} layout="vertical" margin={{ left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={140} />
            <Tooltip />
            <Bar dataKey="total" name="Consultations" fill="#3b82c4" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
