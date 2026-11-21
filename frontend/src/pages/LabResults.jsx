import { useCallback, useEffect, useState } from "react";
import { api, downloadPdf, unwrap } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Modal } from "../ui.jsx";

const STATUS = [
  ["requested", "Demandée"],
  ["in_progress", "En cours d'analyse"],
  ["available", "Résultat disponible"],
];

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");

function errorText(error, fallback) {
  const data = error?.payload;
  if (!data || typeof data !== "object") return fallback;
  const parts = Object.values(data).flatMap((v) => (Array.isArray(v) ? v : [v]));
  return parts.filter((p) => typeof p === "string").join(" ") || fallback;
}

export default function LabResults() {
  const { notify } = useAuth();
  const [items, setItems] = useState([]);
  const [patients, setPatients] = useState([]);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (filter) params.set("status", filter);
    if (search) params.set("search", search);
    try {
      setItems(unwrap(await api(`/lab-results/?${params}`)));
    } catch {
      notify("error", "Impossible de charger les analyses.");
    }
  }, [filter, search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    api("/patients/")
      .then((d) => setPatients(unwrap(d)))
      .catch(() => setPatients([]));
  }, []);

  return (
    <div>
      <div className="card-head">
        <h1>Analyses</h1>
        <button className="btn" onClick={() => setCreating(true)}>
          Nouvelle analyse
        </button>
      </div>
      <p className="muted">
        Quand un résultat passe à « Résultat disponible », le patient est prévenu dans son espace
        et par WhatsApp s'il a activé les alertes.
      </p>

      <div className="toolbar">
        <input
          className="input"
          placeholder="Rechercher un patient ou une analyse"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Tous les statuts</option>
          {STATUS.map(([v, l]) => (
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
              <th>Patient</th>
              <th>Analyse</th>
              <th>Prescrite le</th>
              <th>Statut</th>
              <th>Fichier</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  Aucune analyse.
                </td>
              </tr>
            )}
            {items.map((r) => (
              <tr key={r.id}>
                <td>{r.patient_name}</td>
                <td>
                  {r.test_name}
                  {r.doctor_name && (
                    <>
                      <br />
                      <small className="muted">Dr {r.doctor_name}</small>
                    </>
                  )}
                </td>
                <td>{fmtDate(r.requested_at)}</td>
                <td>
                  <span className={`badge ${r.status === "available" ? "" : "warn"}`}>
                    {r.status_label}
                  </span>
                  {r.available_at && (
                    <>
                      <br />
                      <small className="muted">publié le {fmtDate(r.available_at)}</small>
                    </>
                  )}
                </td>
                <td>
                  {r.has_file ? (
                    <button
                      type="button"
                      className="linkish-dark"
                      onClick={() =>
                        downloadPdf(`/lab-results/${r.id}/download/`, r.file_name).catch(() =>
                          notify("error", "Téléchargement impossible.")
                        )
                      }
                    >
                      {r.file_name}
                    </button>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>
                  <button className="btn secondary" onClick={() => setEditing(r)}>
                    {r.status === "available" ? "Modifier" : "Saisir le résultat"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {creating && (
        <CreateModal
          patients={patients}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            notify("success", "Analyse enregistrée.");
            load();
          }}
        />
      )}
      {editing && (
        <ResultModal
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={(published) => {
            setEditing(null);
            notify(
              "success",
              published ? "Résultat publié : le patient a été prévenu." : "Résultat enregistré."
            );
            load();
          }}
        />
      )}
    </div>
  );
}

function CreateModal({ patients, onClose, onSaved }) {
  const [form, setForm] = useState({ patient: "", test_name: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api("/lab-results/", { method: "POST", body: { ...form, patient: Number(form.patient) } });
      onSaved();
    } catch (err) {
      setError(errorText(err, "Enregistrement impossible."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Nouvelle analyse" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="lab-patient">Patient</label>
          <select
            id="lab-patient"
            required
            value={form.patient}
            onChange={(e) => setForm({ ...form, patient: e.target.value })}
          >
            <option value="">— Choisir —</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name || p.user?.username} ({p.patient_code})
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="lab-name">Analyse</label>
          <input
            id="lab-name"
            className="input"
            required
            placeholder="Ex. NFS, glycémie à jeun, bilan lipidique"
            value={form.test_name}
            onChange={(e) => setForm({ ...form, test_name: e.target.value })}
          />
        </div>
        {error && <p className="form-error">{error}</p>}
        <button className="btn" disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </form>
    </Modal>
  );
}

function ResultModal({ item, onClose, onSaved }) {
  const [status, setStatus] = useState(item.status);
  const [summary, setSummary] = useState(item.result_summary || "");
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const publishing = status === "available" && item.status !== "available";

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const body = new FormData();
    body.append("status", status);
    body.append("result_summary", summary);
    if (file) body.append("file", file);
    try {
      await api(`/lab-results/${item.id}/`, { method: "PATCH", body });
      onSaved(publishing);
    } catch (err) {
      setError(errorText(err, "Enregistrement impossible."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`${item.test_name} — ${item.patient_name}`} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="lab-status">Statut</label>
          <select id="lab-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="lab-summary">Compte rendu (visible par le patient une fois publié)</label>
          <textarea
            id="lab-summary"
            rows={5}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="lab-file">
            Fichier du laboratoire {item.has_file && `(actuel : ${item.file_name})`}
          </label>
          <input
            id="lab-file"
            className="input"
            type="file"
            accept=".pdf,image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>
        {publishing && (
          <p className="notice card">
            En enregistrant, le résultat devient visible pour le patient, qui reçoit une
            notification et un message WhatsApp (s'il a activé les alertes).
          </p>
        )}
        {error && <p className="form-error">{error}</p>}
        <button className={`btn ${publishing ? "green" : ""}`} disabled={saving}>
          {saving ? "Enregistrement…" : publishing ? "Publier et prévenir le patient" : "Enregistrer"}
        </button>
      </form>
    </Modal>
  );
}
