import { useCallback, useEffect, useMemo, useState } from "react";
import { api, downloadPdf, unwrap } from "../api.js";
import { useAuth } from "../auth.jsx";

const TABS = [
  ["appointments", "Rendez-vous"],
  ["results", "Résultats d'analyse"],
  ["prescriptions", "Ordonnances"],
  ["consultations", "Consultations"],
  ["record", "Dossier médical"],
  ["whatsapp", "WhatsApp"],
];

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "—";
const fmtDay = (d) =>
  new Date(d).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString("fr-FR") : "—");
const hhmm = (t) => (t || "").slice(0, 5);

const startsAt = (a) => new Date(`${a.date}T${a.time}`);
const isUpcoming = (a) =>
  ["scheduled", "confirmed"].includes(a.status) && startsAt(a) >= new Date();

function errorText(error, fallback) {
  const data = error?.payload;
  if (!data || typeof data !== "object") return fallback;
  const parts = Object.values(data).flatMap((v) => (Array.isArray(v) ? v : [v]));
  return parts.filter((p) => typeof p === "string").join(" ") || fallback;
}

function StatusBadge({ status, label }) {
  const tone = {
    available: "",
    confirmed: "",
    completed: "",
    sent: "",
    requested: "warn",
    in_progress: "warn",
    scheduled: "warn",
    waiting: "warn",
    skipped: "warn",
    cancelled: "danger",
    failed: "danger",
  }[status];
  return <span className={`badge ${tone || ""}`}>{label}</span>;
}

function Empty({ children }) {
  return <p className="muted portal-empty">{children}</p>;
}

export default function PatientPortal() {
  const { user, notify } = useAuth();
  const [tab, setTab] = useState(() => {
    try {
      return sessionStorage.getItem("portal-tab") || "appointments";
    } catch {
      return "appointments";
    }
  });
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    patient: null,
    appointments: [],
    results: [],
    prescriptions: [],
    consultations: [],
    record: null,
    whatsapp: null,
    messages: [],
  });

  const load = useCallback(async () => {
    const safe = (p) => p.catch(() => null);
    const [patients, appointments, results, prescriptions, consultations, records, whatsapp, messages] =
      await Promise.all([
        safe(api("/patients/")),
        safe(api("/appointments/")),
        safe(api("/lab-results/")),
        safe(api("/prescriptions/")),
        safe(api("/consultations/")),
        safe(api("/medical-records/")),
        safe(api("/portal/whatsapp/")),
        safe(api("/whatsapp-messages/")),
      ]);
    setData({
      patient: unwrap(patients)[0] || null,
      appointments: unwrap(appointments),
      results: unwrap(results),
      prescriptions: unwrap(prescriptions),
      consultations: unwrap(consultations),
      record: unwrap(records)[0] || null,
      whatsapp,
      messages: unwrap(messages),
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectTab = (key) => {
    setTab(key);
    try {
      sessionStorage.setItem("portal-tab", key);
    } catch {
      /* stockage indisponible : sans conséquence */
    }
  };

  const upcoming = useMemo(
    () => data.appointments.filter(isUpcoming).sort((a, b) => startsAt(a) - startsAt(b)),
    [data.appointments]
  );
  const past = useMemo(
    () => data.appointments.filter((a) => !isUpcoming(a)),
    [data.appointments]
  );
  const availableResults = data.results.filter((r) => r.status === "available");
  const next = upcoming[0];

  if (loading) {
    return <p className="muted">Chargement de votre espace…</p>;
  }

  if (!data.patient) {
    return (
      <div className="card notice warn">
        Aucun dossier patient n'est associé à votre compte. Contactez l'accueil de la clinique.
      </div>
    );
  }

  return (
    <div className="portal">
      <header className="portal-hero">
        <div>
          <h1>Bonjour {user?.first_name || user?.username}</h1>
          <p>
            Votre espace patient · dossier <strong>{data.patient.patient_code}</strong>
          </p>
        </div>
      </header>

      <div className="portal-tiles">
        <button type="button" className="card portal-tile" onClick={() => selectTab("appointments")}>
          <span className="portal-tile-label">Prochain rendez-vous</span>
          {next ? (
            <>
              <b>
                {fmtDay(next.date)} à {hhmm(next.time)}
              </b>
              <span className="muted">
                Dr {next.doctor_name} · {next.specialty_name}
              </span>
            </>
          ) : (
            <b>Aucun rendez-vous prévu</b>
          )}
        </button>

        <button type="button" className="card portal-tile" onClick={() => selectTab("results")}>
          <span className="portal-tile-label">Résultats d'analyse</span>
          <b>
            {availableResults.length} disponible{availableResults.length > 1 ? "s" : ""}
          </b>
          <span className="muted">
            {data.results.length - availableResults.length} en cours
          </span>
        </button>

        <button type="button" className="card portal-tile" onClick={() => selectTab("whatsapp")}>
          <span className="portal-tile-label">Alertes WhatsApp</span>
          <b>{data.whatsapp?.whatsapp_opt_in ? "Activées" : "Désactivées"}</b>
          <span className="muted">
            {data.whatsapp?.whatsapp_opt_in
              ? data.whatsapp.effective_number
              : "Activez-les pour être prévenu"}
          </span>
        </button>
      </div>

      <nav className="tabs" role="tablist">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? "active" : ""}
            onClick={() => selectTab(key)}
          >
            {label}
            {key === "results" && availableResults.length > 0 && (
              <span className="tab-count">{availableResults.length}</span>
            )}
          </button>
        ))}
      </nav>

      <section className="portal-panel">
        {tab === "appointments" && (
          <AppointmentsPanel upcoming={upcoming} past={past} />
        )}
        {tab === "results" && <ResultsPanel results={data.results} notify={notify} />}
        {tab === "prescriptions" && (
          <PrescriptionsPanel prescriptions={data.prescriptions} notify={notify} />
        )}
        {tab === "consultations" && <ConsultationsPanel consultations={data.consultations} />}
        {tab === "record" && <RecordPanel record={data.record} />}
        {tab === "whatsapp" && (
          <WhatsAppPanel
            prefs={data.whatsapp}
            messages={data.messages}
            accountPhone={user?.phone}
            notify={notify}
            onChange={load}
          />
        )}
      </section>
    </div>
  );
}

function AppointmentsPanel({ upcoming, past }) {
  return (
    <>
      <div className="card">
        <h3>À venir</h3>
        {upcoming.length === 0 && (
          <Empty>Aucun rendez-vous à venir. Pour en prendre un, contactez l'accueil.</Empty>
        )}
        <ul className="portal-list">
          {upcoming.map((a) => (
            <li key={a.id}>
              <div className="portal-date">
                <b>{new Date(a.date).getDate()}</b>
                <span>
                  {new Date(a.date).toLocaleDateString("fr-FR", { month: "short" })}
                </span>
              </div>
              <div className="portal-item-main">
                <strong>
                  {fmtDay(a.date)} à {hhmm(a.time)}
                </strong>
                <span className="muted">
                  Dr {a.doctor_name} · {a.specialty_name}
                  {a.reason ? ` · ${a.reason}` : ""}
                </span>
                {a.reminder_sent_at && (
                  <small className="muted">
                    Rappel WhatsApp envoyé le {fmtDateTime(a.reminder_sent_at)}
                  </small>
                )}
              </div>
              <StatusBadge status={a.status} label={a.status_label} />
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h3>Historique</h3>
        {past.length === 0 && <Empty>Aucun rendez-vous passé.</Empty>}
        {past.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Médecin</th>
                  <th>Motif</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {past.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {fmtDate(a.date)} {hhmm(a.time)}
                    </td>
                    <td>
                      Dr {a.doctor_name}
                      <br />
                      <small className="muted">{a.specialty_name}</small>
                    </td>
                    <td>{a.reason || "—"}</td>
                    <td>
                      <StatusBadge status={a.status} label={a.status_label} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function ResultsPanel({ results, notify }) {
  const download = async (r) => {
    try {
      await downloadPdf(`/lab-results/${r.id}/download/`, r.file_name || `resultat-${r.id}`);
    } catch {
      notify("error", "Téléchargement impossible.");
    }
  };

  if (results.length === 0) {
    return (
      <div className="card">
        <Empty>Aucune analyse pour le moment.</Empty>
      </div>
    );
  }

  return (
    <div className="portal-results">
      {results.map((r) => (
        <article key={r.id} className={`card result-card ${r.status}`}>
          <div className="card-head">
            <h3>{r.test_name}</h3>
            <StatusBadge status={r.status} label={r.status_label} />
          </div>
          <p className="muted result-meta">
            Prescrite le {fmtDate(r.requested_at)}
            {r.doctor_name ? ` par le Dr ${r.doctor_name}` : ""}
            {r.available_at ? ` · disponible depuis le ${fmtDate(r.available_at)}` : ""}
          </p>
          {r.status === "available" ? (
            <>
              {r.result_summary && <p className="result-summary">{r.result_summary}</p>}
              {r.has_file && (
                <button type="button" className="btn secondary" onClick={() => download(r)}>
                  Télécharger le compte rendu
                </button>
              )}
              <p className="muted result-note">
                Pour toute question sur ce résultat, parlez-en à votre médecin.
              </p>
            </>
          ) : (
            <p className="muted">
              Votre résultat n'est pas encore disponible. Vous serez prévenu dès sa publication.
            </p>
          )}
        </article>
      ))}
    </div>
  );
}

function PrescriptionsPanel({ prescriptions, notify }) {
  const download = async (id) => {
    try {
      await downloadPdf(`/prescriptions/${id}/pdf/`, `ordonnance-${id}.pdf`);
    } catch {
      notify("error", "Téléchargement impossible.");
    }
  };

  if (prescriptions.length === 0) {
    return (
      <div className="card">
        <Empty>Aucune ordonnance.</Empty>
      </div>
    );
  }

  return (
    <div className="portal-results">
      {prescriptions.map((p) => (
        <article key={p.id} className="card">
          <div className="card-head">
            <h3>Ordonnance du {fmtDate(p.date)}</h3>
            <button type="button" className="btn secondary" onClick={() => download(p.id)}>
              PDF
            </button>
          </div>
          <p className="muted result-meta">Dr {p.doctor_name}</p>
          <ul className="med-list">
            {p.items.map((it) => (
              <li key={it.id}>
                <strong>{it.medication}</strong>
                {it.dosage && ` — ${it.dosage}`}
                <br />
                <span className="muted">
                  {[it.posology, it.duration, it.instructions].filter(Boolean).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
          {p.instructions && <p>{p.instructions}</p>}
        </article>
      ))}
    </div>
  );
}

function ConsultationsPanel({ consultations }) {
  if (consultations.length === 0) {
    return (
      <div className="card">
        <Empty>Aucune consultation enregistrée.</Empty>
      </div>
    );
  }
  return (
    <div className="portal-results">
      {consultations.map((c) => (
        <article key={c.id} className="card">
          <div className="card-head">
            <h3>{c.reason}</h3>
            <span className="muted">{fmtDate(c.date)}</span>
          </div>
          <p className="muted result-meta">Dr {c.doctor_name}</p>
          <dl className="portal-dl">
            {[
              ["Diagnostic", c.diagnosis],
              ["Traitement", c.treatment],
              ["Recommandations", c.recommendations],
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
          </dl>
        </article>
      ))}
    </div>
  );
}

function RecordPanel({ record }) {
  if (!record) {
    return (
      <div className="card">
        <Empty>Dossier médical indisponible.</Empty>
      </div>
    );
  }
  const rows = [
    ["Groupe sanguin", record.blood_type],
    ["Allergies", record.allergies],
    ["Antécédents médicaux", record.medical_history],
    ["Antécédents chirurgicaux", record.surgical_history],
    ["Traitements en cours", record.current_treatments],
  ];
  return (
    <div className="card">
      <div className="card-head">
        <h3>Mon dossier médical</h3>
        <small className="muted">Mis à jour le {fmtDate(record.updated_at)}</small>
      </div>
      <dl className="portal-dl">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v || <span className="muted">Non renseigné</span>}</dd>
          </div>
        ))}
      </dl>
      <p className="muted result-note">
        Une information est inexacte ? Signalez-le à votre médecin lors de votre prochaine visite.
      </p>
    </div>
  );
}

function WhatsAppPanel({ prefs, messages, accountPhone, notify, onChange }) {
  const [optIn, setOptIn] = useState(Boolean(prefs?.whatsapp_opt_in));
  const [number, setNumber] = useState(prefs?.whatsapp_number || "");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");

  const dirty =
    optIn !== Boolean(prefs?.whatsapp_opt_in) || number !== (prefs?.whatsapp_number || "");

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api("/portal/whatsapp/", {
        method: "PATCH",
        body: { whatsapp_opt_in: optIn, whatsapp_number: number },
      });
      notify("success", optIn ? "Alertes WhatsApp activées." : "Alertes WhatsApp désactivées.");
      await onChange();
    } catch (err) {
      setError(errorText(err, "Enregistrement impossible."));
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      const log = await api("/portal/whatsapp/test/", { method: "POST" });
      if (log.status === "sent" && log.provider === "console")
        notify("error", "Mode démonstration : le message n'est pas réellement envoyé sur WhatsApp.");
      else if (log.status === "sent") notify("success", `Message de test envoyé au ${log.to_number}.`);
      else notify("error", log.error || "Le message n'a pas pu être envoyé.");
      await onChange();
    } catch {
      notify("error", "Le message n'a pas pu être envoyé.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <>
      <form className="card" onSubmit={save}>
        <h3>Alertes WhatsApp</h3>
        <p className="muted">
          Recevez sur WhatsApp un rappel la veille de chaque rendez-vous et une alerte dès qu'un
          résultat d'analyse est disponible. Le contenu de vos résultats n'est jamais envoyé par
          WhatsApp : il reste consultable uniquement ici.
        </p>

        <label className="switch-row">
          <input
            type="checkbox"
            checked={optIn}
            onChange={(e) => setOptIn(e.target.checked)}
          />
          <span>J'accepte de recevoir des messages WhatsApp de la clinique</span>
        </label>

        <div className="field">
          <label htmlFor="wa-number">Numéro WhatsApp</label>
          <input
            id="wa-number"
            className="input"
            type="tel"
            inputMode="tel"
            placeholder={accountPhone || "+228 90 12 34 56"}
            value={number}
            onChange={(e) => setNumber(e.target.value)}
          />
          <small className="muted">
            Format international avec l'indicatif du pays.
            {accountPhone && " Laissez vide pour utiliser le téléphone de votre profil."}
          </small>
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="toolbar">
          <button className="btn" disabled={saving || !dirty}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
          <button
            type="button"
            className="btn secondary"
            disabled={testing || dirty || !prefs?.whatsapp_opt_in}
            onClick={sendTest}
            title={dirty ? "Enregistrez d'abord vos préférences" : undefined}
          >
            {testing ? "Envoi…" : "Envoyer un message de test"}
          </button>
        </div>
      </form>

      <div className="card">
        <h3>Messages reçus</h3>
        {messages.length === 0 && <Empty>Aucun message WhatsApp envoyé pour le moment.</Empty>}
        <ul className="timeline">
          {messages.slice(0, 20).map((m) => (
            <li key={m.id}>
              <div>
                <StatusBadge status={m.status} label={m.status_label} />{" "}
                <strong>{m.kind_label}</strong>
                <small className="muted"> · {fmtDateTime(m.created_at)}</small>
              </div>
              <p className="wa-body">{m.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
