import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api.js";

const COLORS = {
  navy: "#0b5f8a",
  green: "#1b8a6b",
  orange: "#d68910",
  purple: "#7b5ea7",
  red: "#c0392b",
  sky: "#4fa3d1",
  grey: "#9aabb5",
};

const SERIES = [
  { key: "appointments", label: "Rendez-vous", color: COLORS.navy },
  { key: "consultations", label: "Consultations", color: COLORS.green },
  { key: "prescriptions", label: "Ordonnances", color: COLORS.orange },
  { key: "patients", label: "Nouveaux patients", color: COLORS.purple },
];

const STATUS_COLORS = {
  scheduled: COLORS.sky,
  confirmed: COLORS.navy,
  waiting: COLORS.orange,
  completed: COLORS.green,
  cancelled: COLORS.red,
};

const PIE_PALETTE = [COLORS.navy, COLORS.green, COLORS.orange, COLORS.purple, COLORS.sky, COLORS.grey];

const PERIODS = [
  { value: 6, label: "6 mois" },
  { value: 12, label: "12 mois" },
  { value: 24, label: "24 mois" },
];

const monthLabel = (iso) =>
  new Date(iso).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });

const sum = (rows = [], key = "total") => rows.reduce((acc, r) => acc + (r[key] || 0), 0);

function ChartCard({ title, subtitle, children, wide, empty }) {
  return (
    <section className={`chart-card${wide ? " chart-wide" : ""}`}>
      <header>
        <h3>{title}</h3>
        {subtitle && <span>{subtitle}</span>}
      </header>
      {empty ? <div className="chart-empty">Aucune donnée pour le moment</div> : children}
    </section>
  );
}

function Donut({ data, nameKey, colorFor }) {
  const total = sum(data);
  return (
    <div className="donut-wrap">
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            dataKey="total"
            nameKey={nameKey}
            innerRadius={62}
            outerRadius={95}
            paddingAngle={data.length > 1 ? 2 : 0}
            stroke="none"
          >
            {data.map((d, i) => (
              <Cell key={i} fill={colorFor(d, i)} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => [`${v} (${Math.round((100 * v) / total)} %)`, ""]} />
          <Legend verticalAlign="bottom" iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
      <div className="donut-center">
        <b>{total}</b>
        <span>total</span>
      </div>
    </div>
  );
}

export default function Statistics() {
  const [months, setMonths] = useState(12);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError("");
    api(`/stats/analytics/?months=${months}`)
      .then(setData)
      .catch(() => setError("Impossible de charger les statistiques."))
      .finally(() => setLoading(false));
  }, [months]);

  if (!data) {
    return (
      <div className="stats-page">
        <h1>Statistiques</h1>
        {error ? <p className="error">{error}</p> : <p className="muted">Chargement…</p>}
      </div>
    );
  }

  const activity = data.activity_by_month.map((r) => ({ ...r, label: monthLabel(r.month) }));
  const periodTotals = Object.fromEntries(SERIES.map((s) => [s.key, sum(activity, s.key)]));

  const kpis = [
    { label: "Patients", value: data.patients_total, hint: `+${periodTotals.patients} sur la période` },
    { label: "Rendez-vous", value: data.appointments_total, hint: `${periodTotals.appointments} sur la période` },
    { label: "Consultations", value: data.consultations_total, hint: `${periodTotals.consultations} sur la période` },
    { label: "Ordonnances", value: data.prescriptions_total, hint: `${periodTotals.prescriptions} sur la période` },
    { label: "Taux de RDV terminés", value: `${data.completion_rate} %`, hint: "sur tous les rendez-vous" },
    { label: "Taux d'annulation", value: `${data.cancellation_rate} %`, hint: "sur tous les rendez-vous", warn: data.cancellation_rate > 15 },
  ];

  const staff = [
    { name: "Docteurs", total: data.doctors_total },
    { name: "Infirmiers", total: data.nurses_total },
    { name: "Réceptionnistes", total: data.receptionists_total },
  ];

  return (
    <div className="stats-page">
      <div className="stats-head">
        <div>
          <h1>Statistiques</h1>
          <p className="muted">Vue d'ensemble de l'activité de Bio Care Plus.</p>
        </div>
        <div className="period-switch" role="group" aria-label="Période">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              className={months === p.value ? "active" : ""}
              onClick={() => setMonths(p.value)}
              disabled={loading}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="kpi-grid">
        {kpis.map((k) => (
          <div className={`kpi${k.warn ? " kpi-warn" : ""}`} key={k.label}>
            <span>{k.label}</span>
            <b>{k.value}</b>
            <small>{k.hint}</small>
          </div>
        ))}
      </div>

      <div className={`chart-grid${loading ? " is-loading" : ""}`}>
        <ChartCard
          wide
          title="Activité mensuelle"
          subtitle={`${months} derniers mois`}
          empty={SERIES.every((s) => periodTotals[s.key] === 0)}
        >
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={activity} margin={{ top: 10, right: 16, left: -16, bottom: 0 }}>
              <defs>
                {SERIES.map((s) => (
                  <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={s.color} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e3ebf0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip />
              <Legend iconType="circle" />
              {SERIES.map((s) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  fill={`url(#g-${s.key})`}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Rendez-vous par statut" empty={!data.appointments_by_status.length}>
          <Donut
            data={data.appointments_by_status}
            nameKey="label"
            colorFor={(d, i) => STATUS_COLORS[d.status] || PIE_PALETTE[i % PIE_PALETTE.length]}
          />
        </ChartCard>

        <ChartCard title="Rendez-vous par spécialité" subtitle="hors annulés" empty={!data.appointments_by_specialty.length}>
          <ResponsiveContainer width="100%" height={Math.max(240, data.appointments_by_specialty.length * 38)}>
            <BarChart data={data.appointments_by_specialty} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e3ebf0" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="specialty" width={130} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="total" name="Rendez-vous" fill={COLORS.navy} radius={[0, 6, 6, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Consultations par docteur" subtitle="top 10" empty={!data.consultations_by_doctor.length}>
          <ResponsiveContainer width="100%" height={Math.max(240, data.consultations_by_doctor.length * 38)}>
            <BarChart data={data.consultations_by_doctor} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e3ebf0" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="doctor" width={130} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="total" name="Consultations" fill={COLORS.green} radius={[0, 6, 6, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Affluence par jour de la semaine" empty={sum(data.appointments_by_weekday) === 0}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.appointments_by_weekday} margin={{ left: -16, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e3ebf0" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="total" name="Rendez-vous" fill={COLORS.sky} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Patients par sexe" empty={!data.patients_by_sex.length}>
          <Donut data={data.patients_by_sex} nameKey="sex" colorFor={(_, i) => PIE_PALETTE[i % PIE_PALETTE.length]} />
        </ChartCard>

        <ChartCard
          title="Patients par tranche d'âge"
          subtitle={data.unknown_age ? `${data.unknown_age} sans date de naissance` : undefined}
          empty={sum(data.patients_by_age) === 0}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.patients_by_age} margin={{ left: -16, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e3ebf0" vertical={false} />
              <XAxis dataKey="range" tick={{ fontSize: 12 }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="total" name="Patients" fill={COLORS.purple} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Médicaments les plus prescrits" subtitle="top 8" empty={!data.top_medications.length}>
          <ResponsiveContainer width="100%" height={Math.max(240, data.top_medications.length * 34)}>
            <BarChart data={data.top_medications} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e3ebf0" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="medication" width={150} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="total" name="Prescriptions" fill={COLORS.orange} radius={[0, 6, 6, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Tickets de consultation" empty={!data.tickets_by_status.length}>
          <Donut data={data.tickets_by_status} nameKey="status" colorFor={(_, i) => PIE_PALETTE[i % PIE_PALETTE.length]} />
        </ChartCard>

        <ChartCard wide title="Personnel actif" subtitle={`${data.users_total} comptes utilisateurs`}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={staff} margin={{ left: -16, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e3ebf0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="total" name="Effectif" radius={[6, 6, 0, 0]}>
                {staff.map((_, i) => (
                  <Cell key={i} fill={[COLORS.navy, COLORS.green, COLORS.orange][i]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
