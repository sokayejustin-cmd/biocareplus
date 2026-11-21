import { useCallback, useEffect, useMemo, useState } from "react";
import { api, downloadPdf, unwrap } from "../api.js";
import { useAuth } from "../auth.jsx";

const WRITERS = ["admin", "doctor", "nurse"];

const FIELDS = [
  ["blood_type", "Groupe sanguin", "input"],
  ["allergies", "Allergies", "textarea"],
  ["medical_history", "Antécédents médicaux", "textarea"],
  ["surgical_history", "Antécédents chirurgicaux", "textarea"],
  ["current_treatments", "Traitements en cours", "textarea"],
  ["observations", "Observations", "textarea"],
];

const KIND_LABELS = {
  doctor: "Commentaire médical",
  nurse: "Observation infirmière",
};

const SEX_LABELS = { M: "Masculin", F: "Féminin", O: "Autre" };

const emptyRecord = Object.fromEntries(FIELDS.map(([key]) => [key, ""]));

const fmtDate = (value) =>
  value ? new Date(value).toLocaleDateString("fr-FR") : "—";

const fmtDateTime = (value) =>
  value ? new Date(value).toLocaleString("fr-FR") : "—";

const ageOf = (dob) => {
  if (!dob) return null;
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age;
};

export default function Records() {
  const { user, notify } = useAuth();
  const canWrite = WRITERS.includes(user?.role);
  const isPatient = user?.role === "patient";

  const [patients, setPatients] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  const [loadingDetail, setLoadingDetail] = useState(false);
  const [record, setRecord] = useState(null); // enregistrement existant (ou null)
  const [form, setForm] = useState(emptyRecord);
  const [comments, setComments] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = unwrap(await api("/patients/?page_size=1000"));
        if (!alive) return;
        setPatients(list);
        // Un patient n'a qu'un seul dossier : on l'ouvre directement.
        if (list.length === 1) setSelectedId(list[0].id);
      } catch {
        notify("error", "Impossible de charger les patients.");
      } finally {
        if (alive) setLoadingList(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDetail = useCallback(
    async (patientId) => {
      setLoadingDetail(true);
      const [rec, com, cons, pres] = await Promise.allSettled([
        api(`/medical-records/?patient=${patientId}`),
        api(`/comments/?patient=${patientId}`),
        api(`/consultations/?patient=${patientId}`),
        api(`/prescriptions/?patient=${patientId}`),
      ]);

      const first = rec.status === "fulfilled" ? unwrap(rec.value)[0] || null : null;
      setRecord(first);
      setForm(
        first
          ? Object.fromEntries(FIELDS.map(([key]) => [key, first[key] || ""]))
          : emptyRecord
      );
      setComments(com.status === "fulfilled" ? unwrap(com.value) : []);
      setConsultations(cons.status === "fulfilled" ? unwrap(cons.value) : []);
      setPrescriptions(pres.status === "fulfilled" ? unwrap(pres.value) : []);

      if (rec.status === "rejected") {
        notify("error", "Impossible de charger le dossier médical.");
      }
      setLoadingDetail(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("fr");
    if (!term) return patients;
    return patients.filter((p) =>
      `${p.full_name} ${p.patient_code}`.toLocaleLowerCase("fr").includes(term)
    );
  }, [patients, query]);

  const selected = patients.find((p) => p.id === selectedId) || null;

  const saveRecord = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const saved = record
        ? await api(`/medical-records/${record.id}/`, { method: "PATCH", body: form })
        : await api("/medical-records/", {
            method: "POST",
            body: { ...form, patient: selectedId },
          });
      setRecord(saved);
      notify("success", "Dossier médical enregistré.");
    } catch (error) {
      notify("error", error?.payload?.detail || "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  const addComment = async (event) => {
    event.preventDefault();
    const text = newComment.trim();
    if (!text) return;
    setSendingComment(true);
    try {
      const created = await api("/comments/", {
        method: "POST",
        body: { patient: selectedId, text },
      });
      setComments((list) => [created, ...list]);
      setNewComment("");
    } catch (error) {
      notify("error", error?.payload?.detail || "Commentaire non enregistré.");
    } finally {
      setSendingComment(false);
    }
  };

  const downloadPrescription = async (id) => {
    try {
      await downloadPdf(`/prescriptions/${id}/pdf/`, `ordonnance-${id}.pdf`);
    } catch {
      notify("error", "Téléchargement impossible.");
    }
  };

  const age = ageOf(selected?.date_of_birth);

  return (
    <div className="records-page">
      <h1>{isPatient ? "Mon dossier médical" : "Dossiers médicaux"}</h1>

      <div className={`records-layout ${isPatient ? "single" : ""}`}>
        {!isPatient && (
          <aside className="card records-list">
            <input
              className="input"
              placeholder="Rechercher un patient…"
              aria-label="Rechercher un patient"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {loadingList && <p className="muted">Chargement…</p>}
            {!loadingList && filtered.length === 0 && (
              <p className="muted">Aucun patient.</p>
            )}
            <ul>
              {filtered.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className={p.id === selectedId ? "active" : ""}
                    onClick={() => setSelectedId(p.id)}
                  >
                    <b>{p.full_name || p.user?.username}</b>
                    <small>{p.patient_code}</small>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        )}

        <section className="records-detail">
          {!selected && !loadingList && (
            <div className="card">
              <p className="muted">
                {isPatient
                  ? "Aucun dossier n'est associé à votre compte."
                  : "Sélectionnez un patient pour consulter son dossier."}
              </p>
            </div>
          )}

          {selected && (
            <>
              <div className="card">
                <h2 style={{ marginTop: 0 }}>{selected.full_name}</h2>
                <p className="muted" style={{ margin: 0 }}>
                  {selected.patient_code}
                  {age !== null && ` · ${age} ans`}
                  {selected.sex && ` · ${SEX_LABELS[selected.sex] || selected.sex}`}
                  {selected.date_of_birth && ` · né(e) le ${fmtDate(selected.date_of_birth)}`}
                </p>
                {(selected.emergency_contact_name || selected.emergency_contact_phone) && (
                  <p className="muted">
                    Contact d'urgence : {selected.emergency_contact_name}{" "}
                    {selected.emergency_contact_phone}
                  </p>
                )}
              </div>

              {loadingDetail ? (
                <div className="card">
                  <p className="muted">Chargement du dossier…</p>
                </div>
              ) : (
                <>
                  <form className="card" onSubmit={saveRecord}>
                    <div className="card-head">
                      <h3>Fiche médicale</h3>
                      {record?.updated_at && (
                        <small className="muted">
                          Mise à jour : {fmtDateTime(record.updated_at)}
                        </small>
                      )}
                    </div>
                    {!record && !canWrite && (
                      <p className="muted">Aucune information médicale enregistrée.</p>
                    )}
                    <div className="grid-2">
                      {FIELDS.map(([key, label, kind]) => (
                        <div
                          className="field"
                          key={key}
                          style={kind === "textarea" ? undefined : { gridColumn: "1 / -1" }}
                        >
                          <label htmlFor={`rec-${key}`}>{label}</label>
                          {kind === "textarea" ? (
                            <textarea
                              id={`rec-${key}`}
                              rows={3}
                              value={form[key]}
                              readOnly={!canWrite}
                              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                            />
                          ) : (
                            <input
                              id={`rec-${key}`}
                              className="input"
                              value={form[key]}
                              maxLength={8}
                              readOnly={!canWrite}
                              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                    {canWrite && (
                      <button className="btn" disabled={saving}>
                        {saving ? "Enregistrement…" : "Enregistrer le dossier"}
                      </button>
                    )}
                  </form>

                  <div className="card">
                    <h3>Commentaires et observations</h3>
                    {canWrite && (
                      <form className="comment-form" onSubmit={addComment}>
                        <textarea
                          rows={2}
                          placeholder="Ajouter une observation…"
                          aria-label="Nouveau commentaire"
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                        />
                        <button className="btn green" disabled={sendingComment || !newComment.trim()}>
                          Ajouter
                        </button>
                      </form>
                    )}
                    {comments.length === 0 && <p className="muted">Aucun commentaire.</p>}
                    <ul className="timeline">
                      {comments.map((c) => (
                        <li key={c.id}>
                          <div>
                            <span className={`badge ${c.kind === "doctor" ? "" : "warn"}`}>
                              {KIND_LABELS[c.kind] || c.kind}
                            </span>{" "}
                            <b>{c.author_name}</b>
                            <small className="muted"> · {fmtDateTime(c.created_at)}</small>
                          </div>
                          <p>{c.text}</p>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="card">
                    <h3>Consultations</h3>
                    {consultations.length === 0 ? (
                      <p className="muted">Aucune consultation enregistrée.</p>
                    ) : (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Motif</th>
                              <th>Diagnostic</th>
                              <th>Médecin</th>
                            </tr>
                          </thead>
                          <tbody>
                            {consultations.map((c) => (
                              <tr key={c.id}>
                                <td>{fmtDate(c.date)}</td>
                                <td>{c.reason}</td>
                                <td>{c.diagnosis || "—"}</td>
                                <td>{c.doctor_name ? `Dr ${c.doctor_name}` : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="card">
                    <h3>Ordonnances</h3>
                    {prescriptions.length === 0 ? (
                      <p className="muted">Aucune ordonnance.</p>
                    ) : (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Médecin</th>
                              <th>Médicaments</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {prescriptions.map((p) => (
                              <tr key={p.id}>
                                <td>{fmtDate(p.date)}</td>
                                <td>{p.doctor_name ? `Dr ${p.doctor_name}` : "—"}</td>
                                <td>
                                  {(p.items || []).map((i) => i.medication).join(", ") || "—"}
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="btn secondary"
                                    onClick={() => downloadPrescription(p.id)}
                                  >
                                    PDF
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
