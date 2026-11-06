import { useEffect, useState } from "react";
import { api, fetchAll } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Modal } from "../ui.jsx";

const FIELDS = [
  ["blood_type", "Groupe sanguin", "input"],
  ["allergies", "Allergies", "textarea"],
  ["medical_history", "Antécédents médicaux", "textarea"],
  ["surgical_history", "Antécédents chirurgicaux", "textarea"],
  ["current_treatments", "Traitements en cours", "textarea"],
  ["observations", "Observations", "textarea"],
];

const CAN_EDIT = ["admin", "doctor", "nurse"];

function RecordView({ record }) {
  return (
    <div>
      {FIELDS.map(([key, label]) => (
        <div className="field" key={key}>
          <strong>{label}</strong>
          <div style={{ whiteSpace: "pre-wrap", color: record[key] ? "inherit" : "var(--muted)" }}>
            {record[key] || "Non renseigné"}
          </div>
        </div>
      ))}
      <small style={{ color: "var(--muted)" }}>
        Mis à jour le {new Date(record.updated_at).toLocaleString("fr-FR")}
      </small>
    </div>
  );
}

export default function Records() {
  const { user, notify } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState(null);
  const [editing, setEditing] = useState(null);
  const canEdit = CAN_EDIT.includes(user?.role);

  async function load() {
    setLoading(true);
    try {
      setRecords(await fetchAll("/medical-records/"));
    } catch (err) {
      notify("error", err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save(e) {
    e.preventDefault();
    const body = Object.fromEntries(FIELDS.map(([k]) => [k, editing[k] || ""]));
    try {
      await api(`/medical-records/${editing.id}/`, { method: "PATCH", body });
      notify("success", "Dossier mis à jour.");
      setEditing(null);
      load();
    } catch (err) {
      notify("error", err.message);
    }
  }

  if (loading) return <p>Chargement...</p>;

  // Le patient ne voit que son propre dossier : affichage direct.
  if (user?.role === "patient") {
    return (
      <div>
        <h1>Mon dossier médical</h1>
        <div className="card">
          {records[0] ? <RecordView record={records[0]} /> : <p>Aucun dossier disponible.</p>}
        </div>
      </div>
    );
  }

  const shown = records.filter((r) =>
    (r.patient_name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <h1>Dossiers médicaux</h1>
      <div className="toolbar">
        <input className="input" placeholder="Rechercher un patient..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Patient</th><th>Groupe</th><th>Allergies</th><th>Mis à jour</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr><td colSpan={5}>Aucun dossier.</td></tr>
            ) : (
              shown.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.patient_name}</strong></td>
                  <td>{r.blood_type || "—"}</td>
                  <td>{r.allergies ? <span className="badge warn">{r.allergies.slice(0, 40)}</span> : "—"}</td>
                  <td>{new Date(r.updated_at).toLocaleDateString("fr-FR")}</td>
                  <td style={{ display: "flex", gap: 6 }}>
                    <button className="btn secondary" onClick={() => setViewing(r)}>Voir</button>
                    {canEdit && <button className="btn" onClick={() => setEditing({ ...r })}>Modifier</button>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal open={!!viewing} title={`Dossier — ${viewing?.patient_name || ""}`} onClose={() => setViewing(null)}>
        {viewing && <RecordView record={viewing} />}
      </Modal>

      <Modal open={!!editing} title={`Modifier — ${editing?.patient_name || ""}`} onClose={() => setEditing(null)}>
        {editing && (
          <form onSubmit={save}>
            {FIELDS.map(([key, label, type]) => (
              <div className="field" key={key}>
                <label>{label}</label>
                {type === "input" ? (
                  <input className="input" maxLength={8} value={editing[key] || ""} onChange={(e) => setEditing({ ...editing, [key]: e.target.value })} />
                ) : (
                  <textarea rows={2} value={editing[key] || ""} onChange={(e) => setEditing({ ...editing, [key]: e.target.value })} />
                )}
              </div>
            ))}
            <button className="btn">Enregistrer</button>
          </form>
        )}
      </Modal>
    </div>
  );
}
