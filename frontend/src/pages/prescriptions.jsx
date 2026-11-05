import { useEffect, useMemo, useState } from "react";
import { api, unwrap } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Modal, confirmBox } from "../ui.jsx";

const emptyItem = () => ({
  medication: "",
  dosage: "",
  posology: "",
  duration: "",
  instructions: "",
});

const emptyForm = () => ({
  consultation: "",
  patient: "",
  doctor: "",
  date: "",
  instructions: "",
  observations: "",
  items: [emptyItem()],
});

function getErrorMessage(error) {
  if (!error) return "Une erreur est survenue.";

  if (typeof error === "string") return error;

  if (error.detail) return error.detail;

  if (error.message) return error.message;

  if (typeof error === "object") {
    const messages = [];

    Object.entries(error).forEach(([field, value]) => {
      if (Array.isArray(value)) {
        messages.push(`${field} : ${value.join(", ")}`);
      } else if (typeof value === "string") {
        messages.push(`${field} : ${value}`);
      } else if (value && typeof value === "object") {
        messages.push(`${field} : ${JSON.stringify(value)}`);
      }
    });

    if (messages.length) return messages.join(" | ");
  }

  return "Impossible d'enregistrer l'ordonnance.";
}

function formatDate(date) {
  if (!date) return "—";

  try {
    return new Date(`${date}T00:00:00`).toLocaleDateString("fr-FR");
  } catch {
    return date;
  }
}

function getPersonName(obj, type) {
  if (!obj) return "—";

  if (type === "patient") {
    return (
      obj.patient_name ||
      obj.full_name ||
      obj.user?.full_name ||
      `${obj.user?.first_name || ""} ${obj.user?.last_name || ""}`.trim() ||
      `Patient #${obj.patient || obj.id}`
    );
  }

  return (
    obj.doctor_name ||
    obj.full_name ||
    `${obj.user?.first_name || ""} ${obj.user?.last_name || ""}`.trim() ||
    `Médecin #${obj.doctor || obj.id}`
  );
}

export default function Prescriptions({ create = false }) {
  const { user, notify } = useAuth();

  const [rows, setRows] = useState([]);
  const [consultations, setConsultations] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [q, setQ] = useState("");

  const [open, setOpen] = useState(Boolean(create));
  const [detail, setDetail] = useState(null);

  const [form, setForm] = useState(emptyForm());

  const isDoctor = user?.role === "doctor";
  const isAdmin = user?.role === "admin";

  /*
   * Chargement des ordonnances
   */
  async function loadPrescriptions() {
    try {
      setLoading(true);

      const response = await api.get("/prescriptions/");
      const data = unwrap(response.data);

      setRows(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erreur chargement prescriptions :", error);
      notify?.(getErrorMessage(error?.response?.data), "error");
    } finally {
      setLoading(false);
    }
  }

  /*
   * Chargement des consultations
   */
  async function loadConsultations() {
    try {
      const response = await api.get("/consultations/");
      const data = unwrap(response.data);

      setConsultations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erreur chargement consultations :", error);
      notify?.(getErrorMessage(error?.response?.data), "error");
    }
  }

  useEffect(() => {
    loadPrescriptions();
    loadConsultations();
  }, []);

  /*
   * Consultation sélectionnée
   *
   * Une consultation contient déjà :
   * - patient
   * - doctor
   * - date
   *
   * On les récupère automatiquement pour éviter
   * d'envoyer des informations incohérentes.
   */
  const selectedConsultation = useMemo(() => {
    if (!form.consultation) return null;

    return consultations.find(
      (item) => String(item.id) === String(form.consultation)
    );
  }, [form.consultation, consultations]);

  function openCreate() {
    setForm(emptyForm());
    setDetail(null);
    setOpen(true);
  }

  function closeModal() {
    if (saving) return;

    setOpen(false);
    setForm(emptyForm());
  }

  function handleConsultationChange(event) {
    const consultationId = event.target.value;

    if (!consultationId) {
      setForm((current) => ({
        ...current,
        consultation: "",
        patient: "",
        doctor: "",
        date: "",
      }));

      return;
    }

    const consultation = consultations.find(
      (item) => String(item.id) === String(consultationId)
    );

    if (!consultation) {
      setForm((current) => ({
        ...current,
        consultation: consultationId,
      }));

      return;
    }

    setForm((current) => ({
      ...current,
      consultation: consultation.id,
      patient: consultation.patient || "",
      doctor: consultation.doctor || "",
      date: consultation.date || "",
    }));
  }

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateItem(index, field, value) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]: value,
            }
          : item
      ),
    }));
  }

  function addItem() {
    setForm((current) => ({
      ...current,
      items: [...current.items, emptyItem()],
    }));
  }

  function removeItem(index) {
    setForm((current) => {
      if (current.items.length === 1) {
        return current;
      }

      return {
        ...current,
        items: current.items.filter((_, itemIndex) => itemIndex !== index),
      };
    });
  }

  /*
   * Enregistrement
   */
  async function handleSubmit(event) {
    event.preventDefault();

    if (!isDoctor) {
      notify?.(
        "La création d'une ordonnance est réservée au médecin.",
        "error"
      );
      return;
    }

    if (!form.consultation) {
      notify?.("Veuillez sélectionner une consultation.", "error");
      return;
    }

    if (!form.patient) {
      notify?.("Le patient est obligatoire.", "error");
      return;
    }

    if (!form.doctor) {
      notify?.("Le médecin est obligatoire.", "error");
      return;
    }

    if (!form.date) {
      notify?.("La date est obligatoire.", "error");
      return;
    }

    const validItems = form.items.filter(
      (item) => item.medication.trim() !== ""
    );

    if (validItems.length === 0) {
      notify?.(
        "Veuillez ajouter au moins un médicament.",
        "error"
      );
      return;
    }

    const payload = {
      consultation: Number(form.consultation),
      patient: Number(form.patient),
      doctor: Number(form.doctor),
      date: form.date,

      instructions: form.instructions.trim(),
      observations: form.observations.trim(),

      items: validItems.map((item) => ({
        medication: item.medication.trim(),
        dosage: item.dosage.trim(),
        posology: item.posology.trim(),
        duration: item.duration.trim(),
        instructions: item.instructions.trim(),
      })),
    };

    console.log("PAYLOAD ORDONNANCE :", payload);

    try {
      setSaving(true);

      await api.post("/prescriptions/", payload);

      notify?.("Ordonnance enregistrée avec succès.", "success");

      setOpen(false);
      setForm(emptyForm());

      await loadPrescriptions();
    } catch (error) {
      console.error(
        "Erreur enregistrement ordonnance :",
        error?.response?.data || error
      );

      notify?.(
        getErrorMessage(error?.response?.data),
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  /*
   * Suppression
   */
  async function handleDelete(id) {
    const confirmed = await confirmBox(
      "Voulez-vous vraiment supprimer cette ordonnance ?"
    );

    if (!confirmed) return;

    try {
      await api.delete(`/prescriptions/${id}/`);

      notify?.("Ordonnance supprimée.", "success");

      setDetail(null);
      await loadPrescriptions();
    } catch (error) {
      console.error("Erreur suppression :", error);

      notify?.(
        getErrorMessage(error?.response?.data),
        "error"
      );
    }
  }

  /*
   * Recherche
   */
  const filteredRows = useMemo(() => {
    const search = q.trim().toLowerCase();

    if (!search) return rows;

    return rows.filter((prescription) => {
      const patient = (
        prescription.patient_name || ""
      ).toLowerCase();

      const doctor = (
        prescription.doctor_name || ""
      ).toLowerCase();

      const date = (
        prescription.date || ""
      ).toLowerCase();

      const instructions = (
        prescription.instructions || ""
      ).toLowerCase();

      const observations = (
        prescription.observations || ""
      ).toLowerCase();

      const medications = (prescription.items || [])
        .map((item) => item.medication || "")
        .join(" ")
        .toLowerCase();

      return (
        patient.includes(search) ||
        doctor.includes(search) ||
        date.includes(search) ||
        instructions.includes(search) ||
        observations.includes(search) ||
        medications.includes(search)
      );
    });
  }, [rows, q]);

  return (
    <div className="page prescriptions-page">
      {/* HEADER */}
      <div
        className="page-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div>
          <h1>Ordonnances</h1>

          <p>
            Gestion des prescriptions médicales et des médicaments
            prescrits.
          </p>
        </div>

        {isDoctor && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={openCreate}
          >
            + Nouvelle ordonnance
          </button>
        )}
      </div>

      {/* BARRE DE RECHERCHE */}
      <div
        className="card"
        style={{
          marginBottom: 20,
          padding: 16,
        }}
      >
        <input
          type="text"
          className="form-control"
          placeholder="Rechercher par patient, médecin, médicament..."
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
      </div>

      {/* TABLEAU */}
      <div className="card">
        {loading ? (
          <div style={{ padding: 30, textAlign: "center" }}>
            Chargement des ordonnances...
          </div>
        ) : filteredRows.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center" }}>
            <h3>Aucune ordonnance</h3>

            <p>
              {q
                ? "Aucune ordonnance ne correspond à votre recherche."
                : "Aucune ordonnance n'a encore été enregistrée."}
            </p>
          </div>
        ) : (
          <div
            style={{
              overflowX: "auto",
            }}
          >
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Date</th>
                  <th>Patient</th>
                  <th>Médecin</th>
                  <th>Médicaments</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.map((prescription) => (
                  <tr key={prescription.id}>
                    <td>#{prescription.id}</td>

                    <td>
                      {formatDate(prescription.date)}
                    </td>

                    <td>
                      {prescription.patient_name ||
                        `Patient #${prescription.patient}`}
                    </td>

                    <td>
                      {prescription.doctor_name ||
                        `Médecin #${prescription.doctor}`}
                    </td>

                    <td>
                      {prescription.items?.length
                        ? prescription.items
                            .map((item) => item.medication)
                            .filter(Boolean)
                            .join(", ")
                        : "Aucun médicament"}
                    </td>

                    <td>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() =>
                            setDetail(prescription)
                          }
                        >
                          Voir
                        </button>

                        {isAdmin && (
                          <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() =>
                              handleDelete(prescription.id)
                            }
                          >
                            Supprimer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL NOUVELLE ORDONNANCE */}
      <Modal
        open={open}
        onClose={closeModal}
        title="Nouvelle ordonnance"
      >
        <form onSubmit={handleSubmit}>
          {/* CONSULTATION */}
          <div className="form-group">
            <label htmlFor="consultation">
              Consultation *
            </label>

            <select
              id="consultation"
              className="form-control"
              value={form.consultation}
              onChange={handleConsultationChange}
              required
            >
              <option value="">
                -- Sélectionner une consultation --
              </option>

              {consultations.map((consultation) => (
                <option
                  key={consultation.id}
                  value={consultation.id}
                >
                  Consultation #{consultation.id}
                  {" — "}
                  {formatDate(consultation.date)}
                  {" — "}
                  {consultation.patient_name ||
                    `Patient #${consultation.patient}`}
                  {" — "}
                  {consultation.doctor_name ||
                    `Médecin #${consultation.doctor}`}
                </option>
              ))}
            </select>
          </div>

          {/* INFORMATIONS CONSULTATION */}
          {selectedConsultation && (
            <div
              className="card"
              style={{
                marginTop: 15,
                marginBottom: 20,
                padding: 15,
                background: "#f8f9fa",
              }}
            >
              <h3
                style={{
                  marginTop: 0,
                  marginBottom: 12,
                }}
              >
                Informations de la consultation
              </h3>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 12,
                }}
              >
                <div>
                  <strong>Patient</strong>
                  <div>
                    {getPersonName(
                      selectedConsultation,
                      "patient"
                    )}
                  </div>
                </div>

                <div>
                  <strong>Médecin</strong>
                  <div>
                    {getPersonName(
                      selectedConsultation,
                      "doctor"
                    )}
                  </div>
                </div>

                <div>
                  <strong>Date</strong>
                  <div>
                    {formatDate(selectedConsultation.date)}
                  </div>
                </div>

                <div>
                  <strong>Motif</strong>
                  <div>
                    {selectedConsultation.reason || "—"}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PATIENT / MEDECIN / DATE */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 15,
              marginBottom: 20,
            }}
          >
            <div className="form-group">
              <label>Patient</label>

              <input
                type="text"
                className="form-control"
                value={
                  selectedConsultation
                    ? getPersonName(
                        selectedConsultation,
                        "patient"
                      )
                    : ""
                }
                placeholder="Sélectionnez une consultation"
                readOnly
              />
            </div>

            <div className="form-group">
              <label>Médecin</label>

              <input
                type="text"
                className="form-control"
                value={
                  selectedConsultation
                    ? getPersonName(
                        selectedConsultation,
                        "doctor"
                      )
                    : ""
                }
                placeholder="Sélectionnez une consultation"
                readOnly
              />
            </div>

            <div className="form-group">
              <label>Date</label>

              <input
                type="date"
                className="form-control"
                value={form.date}
                readOnly
              />
            </div>
          </div>

          {/* MEDICAMENTS */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
              marginBottom: 15,
            }}
          >
            <h2 style={{ margin: 0 }}>
              Médicaments
            </h2>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={addItem}
            >
              + Ajouter un médicament
            </button>
          </div>

          {form.items.map((item, index) => (
            <div
              key={index}
              className="card"
              style={{
                padding: 15,
                marginBottom: 15,
                border: "1px solid #ddd",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 15,
                }}
              >
                <h3 style={{ margin: 0 }}>
                  Médicament {index + 1}
                </h3>

                {form.items.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => removeItem(index)}
                  >
                    Supprimer
                  </button>
                )}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 15,
                }}
              >
                {/* MEDICATION */}
                <div className="form-group">
                  <label>
                    Médicament *
                  </label>

                  <input
                    type="text"
                    className="form-control"
                    placeholder="Ex : Paracétamol"
                    value={item.medication}
                    onChange={(event) =>
                      updateItem(
                        index,
                        "medication",
                        event.target.value
                      )
                    }
                    required
                  />
                </div>

                {/* DOSAGE */}
                <div className="form-group">
                  <label>
                    Dosage
                  </label>

                  <input
                    type="text"
                    className="form-control"
                    placeholder="Ex : 500 mg"
                    value={item.dosage}
                    onChange={(event) =>
                      updateItem(
                        index,
                        "dosage",
                        event.target.value
                      )
                    }
                  />
                </div>

                {/* POSOLOGIE */}
                <div className="form-group">
                  <label>
                    Posologie
                  </label>

                  <input
                    type="text"
                    className="form-control"
                    placeholder="Ex : 1 comprimé matin et soir"
                    value={item.posology}
                    onChange={(event) =>
                      updateItem(
                        index,
                        "posology",
                        event.target.value
                      )
                    }
                  />
                </div>

                {/* DUREE */}
                <div className="form-group">
                  <label>
                    Durée
                  </label>

                  <input
                    type="text"
                    className="form-control"
                    placeholder="Ex : 5 jours"
                    value={item.duration}
                    onChange={(event) =>
                      updateItem(
                        index,
                        "duration",
                        event.target.value
                      )
                    }
                  />
                </div>

                {/* INSTRUCTIONS MEDICAMENT */}
                <div
                  className="form-group"
                  style={{
                    gridColumn: "1 / -1",
                  }}
                >
                  <label>
                    Instructions pour ce médicament
                  </label>

                  <input
                    type="text"
                    className="form-control"
                    placeholder="Ex : Après le repas"
                    value={item.instructions}
                    onChange={(event) =>
                      updateItem(
                        index,
                        "instructions",
                        event.target.value
                      )
                    }
                  />
                </div>
              </div>
            </div>
          ))}

          {/* INSTRUCTIONS GENERALES */}
          <div className="form-group">
            <label>
              Instructions générales
            </label>

            <textarea
              className="form-control"
              rows="3"
              placeholder="Instructions générales de l'ordonnance..."
              value={form.instructions}
              onChange={(event) =>
                updateForm(
                  "instructions",
                  event.target.value
                )
              }
            />
          </div>

          {/* OBSERVATIONS */}
          <div className="form-group">
            <label>
              Observations
            </label>

            <textarea
              className="form-control"
              rows="3"
              placeholder="Observations du médecin..."
              value={form.observations}
              onChange={(event) =>
                updateForm(
                  "observations",
                  event.target.value
                )
              }
            />
          </div>

          {/* BOUTONS */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              marginTop: 20,
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={closeModal}
              disabled={saving}
            >
              Annuler
            </button>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving
                ? "Enregistrement..."
                : "Enregistrer l'ordonnance"}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL DETAILS */}
      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={
          detail
            ? `Ordonnance #${detail.id}`
            : "Ordonnance"
        }
      >
        {detail && (
          <div>
            {/* INFOS */}
            <div
              className="card"
              style={{
                padding: 15,
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 15,
                }}
              >
                <div>
                  <strong>Patient</strong>

                  <div>
                    {detail.patient_name ||
                      `Patient #${detail.patient}`}
                  </div>
                </div>

                <div>
                  <strong>Médecin</strong>

                  <div>
                    {detail.doctor_name ||
                      `Médecin #${detail.doctor}`}
                  </div>
                </div>

                <div>
                  <strong>Date</strong>

                  <div>
                    {formatDate(detail.date)}
                  </div>
                </div>

                <div>
                  <strong>Consultation</strong>

                  <div>
                    #{detail.consultation}
                  </div>
                </div>
              </div>
            </div>

            {/* MEDICAMENTS */}
            <h2>Médicaments prescrits</h2>

            {!detail.items ||
            detail.items.length === 0 ? (
              <p>
                Aucun médicament enregistré.
              </p>
            ) : (
              <div
                style={{
                  overflowX: "auto",
                }}
              >
                <table className="table">
                  <thead>
                    <tr>
                      <th>Médicament</th>
                      <th>Dosage</th>
                      <th>Posologie</th>
                      <th>Durée</th>
                      <th>Instructions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {detail.items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>
                            {item.medication}
                          </strong>
                        </td>

                        <td>
                          {item.dosage || "—"}
                        </td>

                        <td>
                          {item.posology || "—"}
                        </td>

                        <td>
                          {item.duration || "—"}
                        </td>

                        <td>
                          {item.instructions || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* INSTRUCTIONS GENERALES */}
            {detail.instructions && (
              <div
                className="card"
                style={{
                  marginTop: 20,
                  padding: 15,
                }}
              >
                <h3>Instructions générales</h3>

                <p
                  style={{
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {detail.instructions}
                </p>
              </div>
            )}

            {/* OBSERVATIONS */}
            {detail.observations && (
              <div
                className="card"
                style={{
                  marginTop: 15,
                  padding: 15,
                }}
              >
                <h3>Observations</h3>

                <p
                  style={{
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {detail.observations}
                </p>
              </div>
            )}

            {/* ACTIONS */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                marginTop: 20,
              }}
            >
              {isAdmin && (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() =>
                    handleDelete(detail.id)
                  }
                >
                  Supprimer
                </button>
              )}

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDetail(null)}
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}