import { useEffect, useMemo, useState } from "react";
import { fetchAll } from "../api.js";
import { useAuth } from "../auth.jsx";
import EmptyState from "../components/EmptyState.jsx";

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const STATUS_CLASS = { cancelled: "danger", waiting: "warn", scheduled: "warn" };

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default function CalendarPage() {
  const { notify } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState(iso(new Date()));

  useEffect(() => {
    fetchAll("/appointments/").then(setAppointments).catch((e) => notify("error", e.message));
  }, []);

  const byDate = useMemo(() => {
    const map = {};
    for (const a of appointments) (map[a.date] ||= []).push(a);
    for (const list of Object.values(map)) list.sort((x, y) => x.time.localeCompare(y.time));
    return map;
  }, [appointments]);

  // Grille du mois, semaines commençant le lundi.
  const cells = useMemo(() => {
    const first = new Date(cursor);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset);
    return Array.from({ length: 42 }, (_, i) =>
      new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    );
  }, [cursor]);

  const move = (delta) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
  const today = iso(new Date());
  const dayList = byDate[selected] || [];

  return (
    <div>
      <h1>Calendrier</h1>
      <div className="toolbar">
        <button className="btn secondary" onClick={() => move(-1)}>‹</button>
        <strong style={{ minWidth: 160, textAlign: "center", textTransform: "capitalize" }}>
          {cursor.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
        </strong>
        <button className="btn secondary" onClick={() => move(1)}>›</button>
        <button
          className="btn secondary"
          onClick={() => {
            const d = new Date();
            setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
            setSelected(today);
          }}
        >
          Aujourd'hui
        </button>
      </div>

      <div className="card" style={{ padding: 8 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
          {DAYS.map((d) => (
            <div key={d} style={{ textAlign: "center", fontSize: 12, color: "var(--muted)", padding: 4 }}>{d}</div>
          ))}
          {cells.map((d) => {
            const key = iso(d);
            const count = (byDate[key] || []).filter((a) => a.status !== "cancelled").length;
            const inMonth = d.getMonth() === cursor.getMonth();
            const isSel = key === selected;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                style={{
                  minHeight: 64,
                  border: `1px solid ${isSel ? "var(--green)" : "var(--line)"}`,
                  borderRadius: 8,
                  background: isSel ? "var(--green-soft)" : "#fff",
                  opacity: inMonth ? 1 : 0.45,
                  textAlign: "left",
                  padding: 6,
                  cursor: "pointer",
                  font: "inherit",
                }}
              >
                <div style={{ fontWeight: key === today ? 700 : 400, color: key === today ? "var(--green)" : "inherit" }}>
                  {d.getDate()}
                </div>
                {count > 0 && <span className="badge" style={{ fontSize: 11 }}>{count} RDV</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h3>
          Rendez-vous du{" "}
          {new Date(selected + "T00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
        </h3>
        {dayList.length === 0 ? (
          <EmptyState
            compact
            variant="calendar"
            title="Aucun rendez-vous ce jour"
            description="Sélectionnez une autre date pour consulter le planning."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Heure</th><th>Patient</th><th>Docteur</th><th>Spécialité</th><th>Motif</th><th>Statut</th></tr>
              </thead>
              <tbody>
                {dayList.map((a) => (
                  <tr key={a.id}>
                    <td>{a.time.slice(0, 5)}</td>
                    <td>{a.patient_name}</td>
                    <td>Dr {a.doctor_name}</td>
                    <td>{a.specialty_name}</td>
                    <td>{a.reason || "—"}</td>
                    <td><span className={`badge ${STATUS_CLASS[a.status] || ""}`}>{a.status_label}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
