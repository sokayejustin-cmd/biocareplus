import { useEffect, useState } from "react";
import { api, unwrap } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Modal, confirmBox } from "../ui.jsx";

const empty = {
  patient: "",
  doctor: "",
  specialty: "",
  date: "",
  time: "",
  reason: "",
  status: "scheduled",
};

const rolesCanCreate = ["admin", "receptionist", "doctor"];

export default function Appointments({ create }) {
  const { user, notify } = useAuth();

  const [rows, setRows] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [specialties, setSpecialties] = useState([]);

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(Boolean(create));
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({ ...empty });
  const [loading, setLoading] = useState(false);

  const canCreate = rolesCanCreate.includes(user?.role);
  const isAdmin = user?.role === "admin";

  const loadAppointments = async () => {
    try {
      const url = q
        ? `/appointments/?search=${encodeURIComponent(q)}`
        : "/appointments/";

      const data = await api(url);
      setRows(unwrap(data) || []);
    } catch (error) {
      console.error("Erreur chargement rendez-vous :", error);
      notify("error", "Impossible de charger les rendez-vous.");
    }
  };

  const loadPatients = async () => {
    try {
      const data = await api("/patients/");
      setPatients(unwrap(data) || []);
    } catch (error) {
      console.error("Erreur chargement patients :", error);
      notify("error", "Impossible de charger les patients.");
    }
  };

  const loadDoctors = async () => {
    try {
      const data = await api("/doctors/");
      setDoctors(unwrap(data) || []);
    } catch (error) {
      console.error("Erreur chargement médecins :", error);
      notify("error", "Impossible de charger les médecins.");
    }
  };

  const loadSpecialties = async () => {
    try {
      const data = await api("/specialties/");
      setSpecialties(unwrap(data) || []);
    } catch (error) {
      console.error("Erreur chargement spécialités :", error);
      notify("error", "Impossible de charger les spécialités.");
    }
  };

  useEffect(() => {
    loadAppointments();
  }, [q]);

  useEffect(() => {
    loadPatients();
    loadDoctors();
    loadSpecialties();
  }, []);

  const updateField = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const openNew = () => {
    setForm({ ...empty });
    setOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();

    if (!form.patient) {
      notify("error", "Veuillez sélectionner un patient.");
      return;
    }

    if (!form.doctor) {
      notify("error", "Veuillez sélectionner un médecin.");
      return;
    }

    if (!form.specialty) {
      notify("error", "Veuillez sélectionner une spécialité.");
      return;
    }

    if (!form.date) {
      notify("error", "Veuillez sélectionner une date.");
      return;
    }

    if (!form.time) {
      notify("error", "Veuillez sélectionner une heure.");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        patient: Number(form.patient),
        doctor: Number(form.doctor),
        specialty: Number(form.specialty),
        date: form.date,
        time: form.time,
        reason: form.reason,
        status: form.status,
      };

      console.log("Données du rendez-vous envoyées :", payload);

      const response = await api("/appointments/", {
        method: "POST",
        body: payload,
      });

      console.log("Rendez-vous créé :", response);

      notify("success", "Rendez-vous enregistré avec succès.");

      setForm({ ...empty });
      setOpen(false);

      await loadAppointments();
    } catch (error) {
      console.error("Erreur création rendez-vous :", error);

      const data = error?.response?.data || error?.data;
      let message = "Impossible d'enregistrer le rendez-vous.";

      if (data) {
        if (typeof data === "string") {
          message = data;
        } else if (data.detail) {
          message = String(data.detail);
        } else if (typeof data === "object") {
          const messages = Object.entries(data).map(([field, errors]) => {
            const text = Array.isArray(errors)
              ? errors.join(", ")
              : typeof errors === "object"
                ? JSON.stringify(errors)
                : String(errors);

            return `${field} : ${text}`;
          });

          if (messages.length) {
            message = messages.join(" | ");
          }
        }
      }

      notify("error", message);
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id) => {
    if (!confirmBox("Voulez-vous vraiment supprimer ce rendez-vous ?")) {
      return;
    }

    try {
      await api(`/appointments/${id}/`, {
        method: "DELETE",
      });

      notify("success", "Rendez-vous supprimé.");
      await loadAppointments();
    } catch (error) {
      console.error("Erreur suppression rendez-vous :", error);
      notify("error", "Suppression non autorisée.");
    }
  };

  const cancelAppointment = async (appointment) => {
    if (!confirmBox("Voulez-vous vraiment annuler ce rendez-vous ?")) {
      return;
    }

    try {
      await api(`/appointments/${appointment.id}/`, {
        method: "PATCH",
        body: {
          status: "cancelled",
        },
      });

      notify("success", "Rendez-vous annulé.");
      await loadAppointments();
    } catch (error) {
      console.error("Erreur annulation rendez-vous :", error);
      notify("error", "Impossible d'annuler le rendez-vous.");
    }
  };

  const statusLabel = (status) => {
    const labels = {
      scheduled: "Programmé",
      confirmed: "Confirmé",
      waiting: "En attente",
      completed: "Terminé",
      cancelled: "Annulé",
    };

    return labels[status] || status || "-";
  };

  const statusClass = (status) => {
    switch (status) {
      case "confirmed":
      case "completed":
        return "badge success";
      case "cancelled":
        return "badge danger";
      case "waiting":
      case "scheduled":
      default:
        return "badge";
    }
  };

  const getPatientName = (appointment) => {
    if (appointment?.patient_name) {
      return appointment.patient_name;
    }

    if (appointment?.patient?.full_name) {
      return appointment.patient.full_name;
    }

    if (appointment?.patient?.user) {
      const first = appointment.patient.user.first_name || "";
      const last = appointment.patient.user.last_name || "";
      const name = `${first} ${last}`.trim();

      if (name) {
        return name;
      }
    }

    return "-";
  };

  const getDoctorName = (appointment) => {
    if (appointment?.doctor_name) {
      return appointment.doctor_name;
    }

    if (appointment?.doctor?.full_name) {
      return appointment.doctor.full_name;
    }

    if (appointment?.doctor?.user) {
      const first = appointment.doctor.user.first_name || "";
      const last = appointment.doctor.user.last_name || "";
      const name = `${first} ${last}`.trim();

      if (name) {
        return `Dr ${name}`;
      }
    }

    return "-";
  };

  const getSpecialtyName = (appointment) => {
    if (appointment?.specialty_name) {
      return appointment.specialty_name;
    }

    if (appointment?.specialty?.name) {
      return appointment.specialty.name;
    }

    return "-";
  };

  return (
    <div>
      <h1>Rendez-vous</h1>

      <div className="toolbar">
        <input
          className="input"
          placeholder="Rechercher un rendez-vous..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        {canCreate && (
          <button className="btn" onClick={openNew}>
            Nouveau rendez-vous
          </button>
        )}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Heure</th>
              <th>Patient</th>
              <th>Médecin</th>
              <th>Spécialité</th>
              <th>Motif</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan="8"
                  style={{ textAlign: "center" }}
                >
                  Aucun rendez-vous trouvé.
                </td>
              </tr>
            ) : (
              rows.map((appointment) => (
                <tr key={appointment.id}>
                  <td>{appointment.date || "-"}</td>

                  <td>{appointment.time || "-"}</td>

                  <td>{getPatientName(appointment)}</td>

                  <td>{getDoctorName(appointment)}</td>

                  <td>{getSpecialtyName(appointment)}</td>

                  <td>{appointment.reason || "-"}</td>

                  <td>
                    <span className={statusClass(appointment.status)}>
                      {statusLabel(appointment.status)}
                    </span>
                  </td>

                  <td>
                    <button
                      className="btn secondary"
                      onClick={() => setDetail(appointment)}
                    >
                      Détails
                    </button>

                    {appointment.status !== "cancelled" &&
                      appointment.status !== "completed" && (
                        <button
                          className="btn secondary"
                          style={{ marginLeft: 8 }}
                          onClick={() => cancelAppointment(appointment)}
                        >
                          Annuler
                        </button>
                      )}

                    {isAdmin && (
                      <button
                        className="btn danger"
                        style={{ marginLeft: 8 }}
                        onClick={() => remove(appointment.id)}
                      >
                        Supprimer
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {open && canCreate && (
        <Modal
          title="Nouveau rendez-vous"
          onClose={() => setOpen(false)}
        >
          <form onSubmit={save}>
            <h3>Informations du rendez-vous</h3>

            <div className="grid-2">
              <div className="field">
                <label>Patient *</label>

                <select
                  value={form.patient}
                  onChange={(e) =>
                    updateField("patient", e.target.value)
                  }
                  required
                >
                  <option value="">
                    Sélectionner un patient
                  </option>

                  {patients.map((patient) => (
                    <option
                      key={patient.id}
                      value={patient.id}
                    >
                      {patient.full_name ||
                        `${patient.user?.first_name || ""} ${
                          patient.user?.last_name || ""
                        }`.trim() ||
                        patient.patient_code ||
                        `Patient ${patient.id}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Médecin *</label>

                <select
                  value={form.doctor}
                  onChange={(e) => {
                    const doctorId = e.target.value;

                    updateField("doctor", doctorId);

                    const selectedDoctor = doctors.find(
                      (doctor) =>
                        String(doctor.id) === String(doctorId)
                    );

                    if (selectedDoctor?.specialty) {
                      const specialtyId =
                        typeof selectedDoctor.specialty === "object"
                          ? selectedDoctor.specialty.id
                          : selectedDoctor.specialty;

                      if (specialtyId != null) {
                        updateField(
                          "specialty",
                          String(specialtyId)
                        );
                      }
                    }
                  }}
                  required
                >
                  <option value="">
                    Sélectionner un médecin
                  </option>

                  {doctors.map((doctor) => (
                    <option
                      key={doctor.id}
                      value={doctor.id}
                    >
                      {doctor.full_name ||
                        `${doctor.user?.first_name || ""} ${
                          doctor.user?.last_name || ""
                        }`.trim() ||
                        `Médecin ${doctor.id}`}
                      {doctor.specialty_name
                        ? ` — ${doctor.specialty_name}`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Spécialité *</label>

                <select
                  value={form.specialty}
                  onChange={(e) =>
                    updateField("specialty", e.target.value)
                  }
                  required
                >
                  <option value="">
                    Sélectionner une spécialité
                  </option>

                  {specialties.map((specialty) => (
                    <option
                      key={specialty.id}
                      value={specialty.id}
                    >
                      {specialty.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Date *</label>

                <input
                  className="input"
                  type="date"
                  value={form.date}
                  onChange={(e) =>
                    updateField("date", e.target.value)
                  }
                  required
                />
              </div>

              <div className="field">
                <label>Heure *</label>

                <input
                  className="input"
                  type="time"
                  value={form.time}
                  onChange={(e) =>
                    updateField("time", e.target.value)
                  }
                  required
                />
              </div>

              <div className="field">
                <label>Statut</label>

                <select
                  value={form.status}
                  onChange={(e) =>
                    updateField("status", e.target.value)
                  }
                >
                  <option value="scheduled">Programmé</option>
                  <option value="confirmed">Confirmé</option>
                  <option value="waiting">En attente</option>
                  <option value="completed">Terminé</option>
                  <option value="cancelled">Annulé</option>
                </select>
              </div>
            </div>

            <div className="field">
              <label>Motif du rendez-vous</label>

              <textarea
                className="input"
                rows="3"
                value={form.reason}
                onChange={(e) =>
                  updateField("reason", e.target.value)
                }
                placeholder="Ex : consultation générale, contrôle, suivi médical..."
              />
            </div>

            <div style={{ marginTop: 20 }}>
              <button
                type="submit"
                className="btn"
                disabled={loading}
              >
                {loading
                  ? "Enregistrement..."
                  : "Enregistrer le rendez-vous"}
              </button>

              <button
                type="button"
                className="btn secondary"
                style={{ marginLeft: 10 }}
                onClick={() => setOpen(false)}
              >
                Annuler
              </button>
            </div>
          </form>
        </Modal>
      )}

      {detail && (
        <Modal
          title="Détails du rendez-vous"
          onClose={() => setDetail(null)}
        >
          <div className="card">
            <p>
              <b>Date :</b> {detail.date || "-"}
            </p>

            <p>
              <b>Heure :</b> {detail.time || "-"}
            </p>

            <p>
              <b>Patient :</b> {getPatientName(detail)}
            </p>

            <p>
              <b>Médecin :</b> {getDoctorName(detail)}
            </p>

            <p>
              <b>Spécialité :</b> {getSpecialtyName(detail)}
            </p>

            <p>
              <b>Statut :</b>{" "}
              <span className={statusClass(detail.status)}>
                {statusLabel(detail.status)}
              </span>
            </p>

            <p>
              <b>Motif :</b>{" "}
              {detail.reason || "Aucun motif renseigné"}
            </p>

            {detail.created_at && (
              <p>
                <b>Créé le :</b> {detail.created_at}
              </p>
            )}
          </div>

          <div style={{ marginTop: 20 }}>
            <button
              className="btn secondary"
              onClick={() => setDetail(null)}
            >
              Fermer
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
