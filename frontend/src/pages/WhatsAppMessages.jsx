import { useCallback, useEffect, useState } from "react";
import { api, unwrap } from "../api.js";
import { useAuth } from "../auth.jsx";

const KINDS = [
  ["appointment_reminder", "Rappel de rendez-vous"],
  ["lab_result", "Résultat d'analyse"],
  ["credentials", "Identifiants de connexion"],
  ["test", "Message de test"],
];

export default function WhatsAppMessages() {
  const { notify } = useAuth();
  const [items, setItems] = useState([]);
  const [kind, setKind] = useState("");
  const [running, setRunning] = useState(false);
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    try {
      setItems(unwrap(await api(`/whatsapp-messages/${kind ? `?kind=${kind}` : ""}`)));
    } catch {
      notify("error", "Impossible de charger le journal.");
    }
  }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  const runReminders = async () => {
    setRunning(true);
    try {
      const res = await api("/whatsapp-messages/run-reminders/", { method: "POST" });
      notify(
        "success",
        res.processed
          ? `${res.sent} rappel(s) envoyé(s) sur ${res.processed}.`
          : "Aucun rendez-vous à rappeler pour le moment."
      );
      load();
    } catch {
      notify("error", "Envoi des rappels impossible.");
    } finally {
      setRunning(false);
    }
  };

  const tone = { sent: "", skipped: "warn", failed: "danger" };

  return (
    <div>
      <div className="card-head">
        <h1>Messages WhatsApp</h1>
        <button className="btn green" onClick={runReminders} disabled={running}>
          {running ? "Envoi…" : "Envoyer les rappels dus maintenant"}
        </button>
      </div>
      <p className="muted">
        Journal de tous les messages adressés aux patients. Les rappels partent automatiquement
        via la tâche planifiée <code>send_appointment_reminders</code> ; le bouton ci-dessus la
        déclenche immédiatement.
      </p>

      <div className="toolbar">
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">Tous les types</option>
          {KINDS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Patient</th>
              <th>Type</th>
              <th>Numéro</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  Aucun message.
                </td>
              </tr>
            )}
            {items.map((m) => (
              <tr key={m.id} className="clickable" onClick={() => setOpen(open === m.id ? null : m.id)}>
                <td>{new Date(m.created_at).toLocaleString("fr-FR")}</td>
                <td>{m.patient_name}</td>
                <td>
                  {m.kind_label}
                  {open === m.id && <p className="wa-body">{m.body}</p>}
                </td>
                <td>{m.to_number || "—"}</td>
                <td>
                  <span className={`badge ${tone[m.status] ?? ""}`}>{m.status_label}</span>
                  <br />
                  <small className="muted">via {m.provider}</small>
                  {m.error && (
                    <>
                      <br />
                      <small className="muted">{m.error}</small>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
