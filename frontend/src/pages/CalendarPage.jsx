import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, unwrap } from "../api.js";
import { useAuth } from "../auth.jsx";

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const STATUS = {
  scheduled: { label: "Programmé", cls: "" },
  confirmed: { label: "Confirmé", cls: "" },
  waiting: { label: "En attente", cls: "warn" },
  completed: { label: "Terminé", cls: "" },
  cancelled: { label: "Annulé", cls: "danger" },
};

const pad = (n) => String(n).padStart(2, "0");
const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const todayIso = () => {
  const now = new Date();
  return iso(now.getFullYear(), now.getMonth(), now.getDate());
};

export default function CalendarPage() {
  const { notify } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-11
  const [selected, setSelected] = useState(todayIso());
  const [doctorId, setDoctorId] = useState("");
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api("/doctors/?page_size=1000")
      .then((data) => setDoctors(unwrap(data)))
      .catch(() => notify("error", "Impossible de charger les médecins."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // getDay(): 0 = dimanche → on décale pour commencer la semaine le lundi.
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const params = new URLSearchParams({
      date__gte: iso(year, month, 1),
      date__lte: iso(year, month, daysInMonth),
      page_size: "1000",
    });
    if (doctorId) params.set("doctor", doctorId);

    api(`/appointments/?${params.toString()}`)
      .then((data) => alive && setAppointments(unwrap(data)))
      .catch(() => alive && notify("error", "Impossible de charger le calendrier."))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, doctorId, daysInMonth]);

  const byDay = useMemo(() => {
    const map = {};
    for (const a of appointments) {
      (map[a.date] ||= []).push(a);
    }
    for (const list of Object.values(map)) {
      list.sort((x, y) => String(x.time).localeCompare(String(y.time)));
    }
    return map;
  }, [appointments]);

  const go = (delta) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  const goToday = () => {
    const d = new Date();
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setSelected(todayIso());
  };

  const title = new Date(year, month, 1).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  const cells = [];
  for (let i = 0; i < offset; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);

  const today = todayIso();
  const dayList = byDay[selected] || [];
  const activeCount = (list) => list.filter((a) => a.status !== "cancelled").length;

  return (
    <div className="calendar-page">
      <div className="cal-head">
        <div>
          <h1 style={{ marginBottom: 4 }}>Calendrier</h1>
          <p className="muted" style={{ margin: 0 }}>
            Vue mensuelle des rendez-vous.
          </p>
        </div>
        <div className="cal-controls">
          <select
            aria-label="Filtrer par médecin"
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
          >
            <option value="">Tous les médecins</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                Dr {d.user?.first_name} {d.user?.last_name}
                {d.specialty_name ? ` — ${d.specialty_name}` : ""}
              </option>
            ))}
          </select>
          <button type="button" className="btn secondary" onClick={() => go(-1)} aria-label="Mois précédent">
            ‹
          </button>
          <strong className="cal-title">{title}</strong>
          <button type="button" className="btn secondary" onClick={() => go(1)} aria-label="Mois suivant">
            ›
          </button>
          <button type="button" className="btn secondary" onClick={goToday}>
            Aujourd'hui
          </button>
        </div>
      </div>

      <div className={`cal-layout ${loading ? "is-loading" : ""}`}>
        <div className="card cal-card">
          <div className="cal-grid cal-weekdays">
            {WEEKDAYS.map((w) => (
              <div key={w}>{w}</div>
            ))}
          </div>
          <div className="cal-grid">
            {cells.map((day, index) => {
              if (day === null) return <div key={`e${index}`} className="cal-cell empty" />;
              const key = iso(year, month, day);
              const list = byDay[key] || [];
              const count = activeCount(list);
              return (
                <button
                  type="button"
                  key={key}
                  className={`cal-cell ${key === today ? "today" : ""} ${
                    key === selected ? "selected" : ""
                  }`}
                  onClick={() => setSelected(key)}
                  aria-label={`${day} ${title}, ${count} rendez-vous`}
                >
                  <span className="cal-day">{day}</span>
                  {count > 0 && <span className="cal-count">{count}</span>}
                  {list.slice(0, 2).map((a) => (
                    <span
                      key={a.id}
                      className={`cal-evt ${a.status === "cancelled" ? "cancelled" : ""}`}
                    >
                      {String(a.time).slice(0, 5)} {a.patient_name}
                    </span>
                  ))}
                  {list.length > 2 && <span className="cal-more">+{list.length - 2}</span>}
                </button>
              );
            })}
          </div>
        </div>

        <aside className="card cal-side">
          <h3 style={{ marginTop: 0 }}>
            {new Date(`${selected}T00:00:00`).toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </h3>
          {dayList.length === 0 ? (
            <p className="muted">Aucun rendez-vous ce jour.</p>
          ) : (
            <ul className="cal-list">
              {dayList.map((a) => {
                const st = STATUS[a.status] || { label: a.status, cls: "" };
                return (
                  <li key={a.id} className={a.status === "cancelled" ? "cancelled" : ""}>
                    <b>{String(a.time).slice(0, 5)}</b>
                    <div>
                      <div>{a.patient_name}</div>
                      <small className="muted">
                        Dr {a.doctor_name}
                        {a.reason ? ` · ${a.reason}` : ""}
                      </small>
                    </div>
                    <span className={`badge ${st.cls}`}>{st.label}</span>
                  </li>
                );
              })}
            </ul>
          )}
          <Link className="btn" to="/app/appointments" style={{ marginTop: 12 }}>
            Gérer les rendez-vous
          </Link>
        </aside>
      </div>
    </div>
  );
}
