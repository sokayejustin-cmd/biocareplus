import { useEffect, useMemo, useState } from "react";
import { api, unwrap } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Modal, confirmBox } from "../ui.jsx";

const emptyForm = {
  patient: "",
  doctor: "",
  appointment: "",
  date: "",
  reason: "",
  symptoms: "",
  diagnosis: "",
  observations: "",
  comments: "",
  treatment: "",
  recommendations: "",
};

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
      }
    });

    if (messages.length > 0) {
      return messages.join(" | ");
    }
  }

  return "Erreur lors de l'opération.";
}

function formatDate(date) {
  if (!date) return "—";

  try {
    return new Date(`${date}T00:00:00`).toLocaleDateString(
      "fr-FR"
    );
  } catch {
    return date;
  }
}

function getPatientName(patient) {
  if (!patient) return "—";

  return (
    patient.full_name ||
    patient.patient_name ||
    patient.user?.full_name ||
    `${patient.user?.first_name || ""} ${
      patient.user?.last_name || ""
    }`.trim() ||
    `Patient #${patient.id}`
  );
}

function getDoctorName(doctor) {
  if (!doctor) return "—";

  return (
    doctor.full_name ||
    doctor.doctor_name ||
    doctor.user?.full_name ||
    `${doctor.user?.first_name || ""} ${
      doctor.user?.last_name || ""
    }`.trim() ||
    `Médecin #${doctor.id}`
  );
}

export default function Consultations({ create = false }) {
  const { user, notify } = useAuth();

  const [rows, setRows] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [q, setQ] = useState("");

  const [open, setOpen] = useState(Boolean(create));
  const [detail, setDetail] = useState(null);

  const [form, setForm] = useState(emptyForm);

  const isDoctor = user?.role === "doctor";
  const isAdmin = user?.role === "admin";

  /*
   * ============================
   * CHARGEMENT DES CONSULTATIONS
   * ============================
   */

  async function loadConsultations() {
    try {
      setLoading(true);

      const response = await api.get("/consultations/");
      const data = unwrap(response.data);

      setRows(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(
        "Erreur chargement consultations :",
        error?.response?.data || error
      );

      notify?.(
        getErrorMessage(error?.response?.data),
        "error"
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * ============================
   * CHARGEMENT DES PATIENTS
   * ============================
   */

  async function loadPatients() {
    try {
      const response = await api.get("/patients/");
      const data = unwrap(response.data);

      setPatients(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(
        "Erreur chargement patients :",
        error?.response?.data || error
      );

      notify?.(
        "Impossible de charger les patients.",
        "error"
      );
    }
  }

  /*
   * ============================
   * CHARGEMENT DES MEDECINS
   * ============================
   */

  async function loadDoctors() {
    try {
      const response = await api.get("/doctors/");
      const data = unwrap(response.data);

      setDoctors(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(
        "Erreur chargement médecins :",
        error?.response?.data || error
      );

      notify?.(
        "Impossible de charger les médecins.",
        "error"
      );
    }
  }

  /*
   * ============================
   * CHARGEMENT DES RENDEZ-VOUS
   * ============================
   */

  async function loadAppointments() {
    try {
      const response = await api.get("/appointments/");
      const data = unwrap(response.data);

      setAppointments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(
        "Erreur chargement rendez-vous :",
        error?.response?.data || error
      );

      notify?.(
        "Impossible de charger les rendez-vous.",
        "error"
      );
    }
  }

  useEffect(() => {
    loadConsultations();
    loadPatients();
    loadDoctors();
    loadAppointments();
  }, []);

  /*
   * ============================
   * FORMULAIRE
   * ============================
   */

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function openCreate() {
    setForm({
      ...emptyForm,
      date: new Date().toISOString().slice(0, 10),
    });

    setDetail(null);
    setOpen(true);
  }

  function closeModal() {
    if (saving) return;

    setOpen(false);
    setForm(emptyForm);
  }

  /*
   * ============================
   * ENREGISTREMENT
   * ============================
   */

  async function handleSubmit(event) {
    event.preventDefault();

    if (!isDoctor) {
      notify?.(
        "La création d'une consultation est réservée au médecin.",
        "error"
      );
      return;
    }

    if (!form.patient) {
      notify?.(
        "Veuillez sélectionner un patient.",
        "error"
      );
      return;
    }

    if (!form.doctor) {
      notify?.(
        "Veuillez sélectionner un médecin.",
        "error"
      );
      return;
    }

    if (!form.date) {
      notify?.(
        "Veuillez sélectionner une date.",
        "error"
      );
      return;
    }

    if (!form.reason.trim()) {
      notify?.(
        "Veuillez saisir le motif de la consultation.",
        "error"
      );
      return;
    }

    const payload = {
      patient: Number(form.patient),
      doctor: Number(form.doctor),
      appointment: form.appointment
        ? Number(form.appointment)
        : null,
      date: form.date,
      reason: form.reason.trim(),
      symptoms: form.symptoms.trim(),
      diagnosis: form.diagnosis.trim(),
      observations: form.observations.trim(),
      comments: form.comments.trim(),
      treatment: form.treatment.trim(),
      recommendations: form.recommendations.trim(),
    };

    console.log("PAYLOAD CONSULTATION :", payload);

    try {
      setSaving(true);

      await api.post("/consultations/", payload);

      notify?.(
        "Consultation enregistrée avec succès.",
        "success"
      );

      setOpen(false);
      setForm(emptyForm);

      await loadConsultations();
    } catch (error) {
      console.error(
        "Erreur enregistrement consultation :",
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
   * ============================
   * SUPPRESSION
   * ============================
   */

  async function handleDelete(id) {
    const confirmed = await confirmBox(
      "Voulez-vous vraiment supprimer cette consultation ?"
    );

    if (!confirmed) return;

    try {
      await api.delete(`/consultations/${id}/`);

      notify?.(
        "Consultation supprimée.",
        "success"
      );

      setDetail(null);

      await loadConsultations();
    } catch (error) {
      console.error(
        "Erreur suppression consultation :",
        error?.response?.data || error
      );

      notify?.(
        getErrorMessage(error?.response?.data),
        "error"
      );
    }
  }

  /*
   * ============================
   * RECHERCHE
   * ============================
   */

  const filteredRows = useMemo(() => {
    const search = q.trim().toLowerCase();

    if (!search) return rows;

    return rows.filter((consultation) => {
      const patient = (
        consultation.patient_name || ""
      ).toLowerCase();

      const doctor = (
        consultation.doctor_name || ""
      ).toLowerCase();

      const reason = (
        consultation.reason || ""
      ).toLowerCase();

      const diagnosis = (
        consultation.diagnosis || ""
      ).toLowerCase();

      const date = (
        consultation.date || ""
      ).toLowerCase();

      return (
        patient.includes(search) ||
        doctor.includes(search) ||
        reason.includes(search) ||
        diagnosis.includes(search) ||
        date.includes(search)
      );
    });
  }, [rows, q]);

  /*
   * ============================
   * AFFICHAGE
   * ============================
   */

  return (
    <div className="page consultations-page">

      {/* ================= HEADER ================= */}

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
          <h1>Consultations</h1>

          <p>
            Gestion des consultations médicales.
          </p>
        </div>

        {isDoctor && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={openCreate}
          >
            + Nouvelle consultation
          </button>
        )}
      </div>

      {/* ================= RECHERCHE ================= */}

      <div
        className="card"
        style={{
          padding: 16,
          marginBottom: 20,
        }}
      >
        <input
          type="text"
          className="form-control"
          placeholder="Rechercher une consultation..."
          value={q}
          onChange={(event) =>
            setQ(event.target.value)
          }
        />
      </div>

      {/* ================= TABLEAU ================= */}

      <div className="card">

        {loading ? (
          <div
            style={{
              padding: 30,
              textAlign: "center",
            }}
          >
            Chargement des consultations...
          </div>
        ) : filteredRows.length === 0 ? (
          <div
            style={{
              padding: 30,
              textAlign: "center",
            }}
          >
            <h3>Aucune consultation</h3>

            <p>
              {q
                ? "Aucune consultation ne correspond à votre recherche."
                : "Aucune consultation n'a encore été enregistrée."}
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
                  <th>Motif</th>
                  <th>Diagnostic</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.map((consultation) => (
                  <tr key={consultation.id}>

                    <td>
                      #{consultation.id}
                    </td>

                    <td>
                      {formatDate(
                        consultation.date
                      )}
                    </td>

                    <td>
                      {consultation.patient_name ||
                        `Patient #${consultation.patient}`}
                    </td>

                    <td>
                      {consultation.doctor_name ||
                        `Médecin #${consultation.doctor}`}
                    </td>

                    <td>
                      {consultation.reason || "—"}
                    </td>

                    <td>
                      {consultation.diagnosis || "—"}
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
                            setDetail(
                              consultation
                            )
                          }
                        >
                          Voir
                        </button>

                        {isAdmin && (
                          <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() =>
                              handleDelete(
                                consultation.id
                              )
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

      {/* ================= MODAL CREATION ================= */}

      <Modal
        open={open}
        onClose={closeModal}
        title="Nouvelle consultation"
      >
        <form onSubmit={handleSubmit}>

          {/* PATIENT */}

          <div className="form-group">
            <label htmlFor="patient">
              Patient *
            </label>

            <select
              id="patient"
              className="form-control"
              value={form.patient}
              onChange={(event) =>
                updateForm(
                  "patient",
                  event.target.value
                )
              }
              required
            >
              <option value="">
                -- Sélectionner un patient --
              </option>

              {patients.map((patient) => (
                <option
                  key={patient.id}
                  value={patient.id}
                >
                  {getPatientName(patient)}
                  {patient.patient_code
                    ? ` — ${patient.patient_code}`
                    : ""}
                </option>
              ))}
            </select>
          </div>

          {/* MEDECIN */}

          <div className="form-group">
            <label htmlFor="doctor">
              Médecin *
            </label>

            <select
              id="doctor"
              className="form-control"
              value={form.doctor}
              onChange={(event) =>
                updateForm(
                  "doctor",
                  event.target.value
                )
              }
              required
            >
              <option value="">
                -- Sélectionner un médecin --
              </option>

              {doctors.map((doctor) => (
                <option
                  key={doctor.id}
                  value={doctor.id}
                >
                  {getDoctorName(doctor)}
                  {doctor.specialty_name
                    ? ` — ${doctor.specialty_name}`
                    : ""}
                </option>
              ))}
            </select>
          </div>

          {/* RENDEZ-VOUS */}

          <div className="form-group">
            <label htmlFor="appointment">
              Rendez-vous
            </label>

            <select
              id="appointment"
              className="form-control"
              value={form.appointment}
              onChange={(event) =>
                updateForm(
                  "appointment",
                  event.target.value
                )
              }
            >
              <option value="">
                -- Aucun rendez-vous --
              </option>

              {appointments.map((appointment) => (
                <option
                  key={appointment.id}
                  value={appointment.id}
                >
                  RDV #{appointment.id}
                  {" — "}
                  {formatDate(appointment.date)}
                  {" "}
                  {appointment.time || ""}
                  {" — "}
                  {appointment.patient_name ||
                    `Patient #${appointment.patient}`}
                </option>
              ))}
            </select>
          </div>

          {/* DATE */}

          <div className="form-group">
            <label htmlFor="date">
              Date *
            </label>

            <input
              id="date"
              type="date"
              className="form-control"
              value={form.date}
              onChange={(event) =>
                updateForm(
                  "date",
                  event.target.value
                )
              }
              required
            />
          </div>

          {/* MOTIF */}

          <div className="form-group">
            <label htmlFor="reason">
              Motif de la consultation *
            </label>

            <input
              id="reason"
              type="text"
              className="form-control"
              placeholder="Ex : Fièvre et maux de tête"
              value={form.reason}
              onChange={(event) =>
                updateForm(
                  "reason",
                  event.target.value
                )
              }
              required
            />
          </div>

          {/* SYMPTOMES */}

          <div className="form-group">
            <label htmlFor="symptoms">
              Symptômes
            </label>

            <textarea
              id="symptoms"
              className="form-control"
              rows="4"
              placeholder="Décrire les symptômes du patient..."
              value={form.symptoms}
              onChange={(event) =>
                updateForm(
                  "symptoms",
                  event.target.value
                )
              }
            />
          </div>

          {/* DIAGNOSTIC */}

          <div className="form-group">
            <label htmlFor="diagnosis">
              Diagnostic
            </label>

            <textarea
              id="diagnosis"
              className="form-control"
              rows="4"
              placeholder="Diagnostic médical..."
              value={form.diagnosis}
              onChange={(event) =>
                updateForm(
                  "diagnosis",
                  event.target.value
                )
              }
            />
          </div>

          {/* OBSERVATIONS */}

          <div className="form-group">
            <label htmlFor="observations">
              Observations
            </label>

            <textarea
              id="observations"
              className="form-control"
              rows="4"
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

          {/* COMMENTAIRES */}

          <div className="form-group">
            <label htmlFor="comments">
              Commentaires
            </label>

            <textarea
              id="comments"
              className="form-control"
              rows="4"
              placeholder="Commentaires supplémentaires..."
              value={form.comments}
              onChange={(event) =>
                updateForm(
                  "comments",
                  event.target.value
                )
              }
            />
          </div>

          {/* TRAITEMENT */}

          <div className="form-group">
            <label htmlFor="treatment">
              Traitement
            </label>

            <textarea
              id="treatment"
              className="form-control"
              rows="4"
              placeholder="Traitement recommandé..."
              value={form.treatment}
              onChange={(event) =>
                updateForm(
                  "treatment",
                  event.target.value
                )
              }
            />
          </div>

          {/* RECOMMANDATIONS */}

          <div className="form-group">
            <label htmlFor="recommendations">
              Recommandations
            </label>

            <textarea
              id="recommendations"
              className="form-control"
              rows="4"
              placeholder="Recommandations au patient..."
              value={form.recommendations}
              onChange={(event) =>
                updateForm(
                  "recommendations",
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
                : "Enregistrer la consultation"}
            </button>
          </div>

        </form>
      </Modal>

      {/* ================= MODAL DETAILS ================= */}

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={
          detail
            ? `Consultation #${detail.id}`
            : "Consultation"
        }
      >
        {detail && (
          <div>

            {/* INFORMATIONS GENERALES */}

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
                  <strong>Rendez-vous</strong>

                  <div>
                    {detail.appointment
                      ? `#${detail.appointment}`
                      : "Aucun"}
                  </div>
                </div>

              </div>
            </div>

            {/* MOTIF */}

            <div
              className="card"
              style={{
                padding: 15,
                marginBottom: 15,
              }}
            >
              <h3>Motif</h3>

              <p>
                {detail.reason || "—"}
              </p>
            </div>

            {/* SYMPTOMES */}

            <div
              className="card"
              style={{
                padding: 15,
                marginBottom: 15,
              }}
            >
              <h3>Symptômes</h3>

              <p
                style={{
                  whiteSpace: "pre-wrap",
                }}
              >
                {detail.symptoms || "—"}
              </p>
            </div>

            {/* DIAGNOSTIC */}

            <div
              className="card"
              style={{
                padding: 15,
                marginBottom: 15,
              }}
            >
              <h3>Diagnostic</h3>

              <p
                style={{
                  whiteSpace: "pre-wrap",
                }}
              >
                {detail.diagnosis || "—"}
              </p>
            </div>

            {/* OBSERVATIONS */}

            <div
              className="card"
              style={{
                padding: 15,
                marginBottom: 15,
              }}
            >
              <h3>Observations</h3>

              <p
                style={{
                  whiteSpace: "pre-wrap",
                }}
              >
                {detail.observations || "—"}
              </p>
            </div>

            {/* COMMENTAIRES */}

            <div
              className="card"
              style={{
                padding: 15,
                marginBottom: 15,
              }}
            >
              <h3>Commentaires</h3>

              <p
                style={{
                  whiteSpace: "pre-wrap",
                }}
              >
                {detail.comments || "—"}
              </p>
            </div>

            {/* TRAITEMENT */}

            <div
              className="card"
              style={{
                padding: 15,
                marginBottom: 15,
              }}
            >
              <h3>Traitement</h3>

              <p
                style={{
                  whiteSpace: "pre-wrap",
                }}
              >
                {detail.treatment || "—"}
              </p>
            </div>

            {/* RECOMMANDATIONS */}

            <div
              className="card"
              style={{
                padding: 15,
                marginBottom: 20,
              }}
            >
              <h3>Recommandations</h3>

              <p
                style={{
                  whiteSpace: "pre-wrap",
                }}
              >
                {detail.recommendations || "—"}
              </p>
            </div>

            {/* ACTIONS */}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
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
                onClick={() =>
                  setDetail(null)
                }
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