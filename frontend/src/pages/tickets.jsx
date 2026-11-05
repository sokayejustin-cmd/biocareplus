
import { useEffect, useState } from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";

function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    patient: "",
    doctor: "",
  });

  // ============================================================
  // TOKEN
  // ============================================================

  const getToken = () => {
    return (
      localStorage.getItem("access") ||
      localStorage.getItem("access_token") ||
      localStorage.getItem("token")
    );
  };

  // ============================================================
  // HEADERS
  // ============================================================

  const getHeaders = () => {
    const token = getToken();

    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  // ============================================================
  // EXTRAIRE LES DONNEES D'UNE REPONSE API
  // Supporte :
  // - tableau simple
  // - réponse DRF paginée { results: [] }
  // ============================================================

  const extractResults = (data) => {
    if (Array.isArray(data)) {
      return data;
    }

    if (data && Array.isArray(data.results)) {
      return data.results;
    }

    return [];
  };

  // ============================================================
  // CHARGER LES TICKETS
  // ============================================================

  const loadTickets = async () => {
    const response = await fetch(`${API_BASE_URL}/tickets/`, {
      method: "GET",
      headers: getHeaders(),
    });

    if (!response.ok) {
      let message = "Impossible de charger les tickets.";

      try {
        const data = await response.json();

        if (data.detail) {
          message = data.detail;
        }
      } catch {
        // Rien à faire
      }

      throw new Error(message);
    }

    const data = await response.json();

    return extractResults(data);
  };

  // ============================================================
  // CHARGER LES PATIENTS
  // ============================================================

  const loadPatients = async () => {
    const response = await fetch(`${API_BASE_URL}/patients/`, {
      method: "GET",
      headers: getHeaders(),
    });

    if (!response.ok) {
      let message = "Impossible de charger les patients.";

      try {
        const data = await response.json();

        if (data.detail) {
          message = data.detail;
        }
      } catch {
        // Rien à faire
      }

      throw new Error(message);
    }

    const data = await response.json();

    return extractResults(data);
  };

  // ============================================================
  // CHARGER LES DOCTEURS
  // ============================================================

  const loadDoctors = async () => {
    const response = await fetch(`${API_BASE_URL}/doctors/`, {
      method: "GET",
      headers: getHeaders(),
    });

    if (!response.ok) {
      let message = "Impossible de charger les docteurs.";

      try {
        const data = await response.json();

        if (data.detail) {
          message = data.detail;
        }
      } catch {
        // Rien à faire
      }

      throw new Error(message);
    }

    const data = await response.json();

    return extractResults(data);
  };

  // ============================================================
  // CHARGER TOUTES LES DONNEES
  // ============================================================

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const [ticketsData, patientsData, doctorsData] =
        await Promise.all([
          loadTickets(),
          loadPatients(),
          loadDoctors(),
        ]);

      console.log("TICKETS API :", ticketsData);
      console.log("PATIENTS API :", patientsData);
      console.log("DOCTEURS API :", doctorsData);

      setTickets(ticketsData);
      setPatients(patientsData);
      setDoctors(doctorsData);
    } catch (err) {
      console.error("Erreur chargement :", err);

      setError(
        err.message ||
          "Une erreur est survenue lors du chargement des données."
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // CHARGEMENT INITIAL
  // ============================================================

  useEffect(() => {
    loadData();
  }, []);

  // ============================================================
  // CREER UN TICKET
  // ============================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (!form.patient) {
      setError("Veuillez sélectionner un patient.");
      return;
    }

    if (!form.doctor) {
      setError("Veuillez sélectionner un docteur.");
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(`${API_BASE_URL}/tickets/`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          patient: Number(form.patient),
          doctor: Number(form.doctor),
        }),
      });

      const data = await response.json();

      console.log("CREATION TICKET :", data);

      if (!response.ok) {
        console.error("Erreur API création ticket :", data);

        let message = "Impossible de créer le ticket.";

        if (data.detail) {
          message = data.detail;
        } else if (data.patient) {
          message = Array.isArray(data.patient)
            ? data.patient[0]
            : data.patient;
        } else if (data.doctor) {
          message = Array.isArray(data.doctor)
            ? data.doctor[0]
            : data.doctor;
        }

        throw new Error(message);
      }

      setSuccess(
        `Ticket ${data.numero || ""} créé avec succès.`
      );

      setForm({
        patient: "",
        doctor: "",
      });

      setShowForm(false);

      await loadData();
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Erreur lors de la création du ticket."
      );
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // MODIFIER LE STATUT
  // ============================================================

  const updateStatus = async (ticketId, statut) => {
    try {
      setError("");
      setSuccess("");

      const response = await fetch(
        `${API_BASE_URL}/tickets/${ticketId}/`,
        {
          method: "PATCH",
          headers: getHeaders(),
          body: JSON.stringify({
            statut,
          }),
        }
      );

      const data = await response.json();

      console.log("MODIFICATION STATUT :", data);

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Impossible de modifier le statut du ticket."
        );
      }

      setSuccess("Statut du ticket mis à jour.");

      await loadData();
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Erreur lors de la modification du ticket."
      );
    }
  };

  // ============================================================
  // APPELER LE PROCHAIN PATIENT
  // ============================================================

  const callNext = async () => {
    setError("");
    setSuccess("");

    const nextTicket = tickets.find(
      (ticket) => ticket.statut === "EN_ATTENTE"
    );

    if (!nextTicket) {
      setError("Aucun patient n'est actuellement en attente.");
      return;
    }

    await updateStatus(nextTicket.id, "EN_COURS");
  };

  // ============================================================
  // IMPRIMER LE BON DE CONSULTATION
  // ============================================================

  const printTicket = async (ticket) => {
    try {
      setError("");
      setSuccess("");

      const token = getToken();

      const response = await fetch(
        `${API_BASE_URL}/tickets/${ticket.id}/pdf/`,
        {
          method: "GET",
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {},
        }
      );

      if (!response.ok) {
        let message =
          "Impossible de générer le bon de consultation.";

        try {
          const data = await response.json();

          if (data.detail) {
            message = data.detail;
          }
        } catch {
          // Réponse PDF ou autre contenu
        }

        throw new Error(message);
      }

      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);

      const newWindow = window.open(url, "_blank");

      if (!newWindow) {
        throw new Error(
          "La fenêtre d'impression a été bloquée par le navigateur."
        );
      }

      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 10000);
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Erreur lors de l'impression du bon de consultation."
      );
    }
  };

  // ============================================================
  // NOM DU PATIENT
  // ============================================================

  const getPatientName = (ticket) => {
    // Le serializer du ticket fournit directement patient_name
    if (ticket.patient_name) {
      return ticket.patient_name;
    }

    const patient = patients.find(
      (p) => Number(p.id) === Number(ticket.patient)
    );

    if (!patient) {
      return "Patient inconnu";
    }

    // Ton PatientSerializer fournit full_name
    if (patient.full_name) {
      return patient.full_name;
    }

    // Sécurité supplémentaire
    const firstName = patient.user?.first_name || "";
    const lastName = patient.user?.last_name || "";

    const fullName = `${firstName} ${lastName}`.trim();

    if (fullName) {
      return fullName;
    }

    return `Patient #${patient.id}`;
  };

  // ============================================================
  // CODE DU PATIENT
  // ============================================================

  const getPatientCode = (ticket) => {
    const patient = patients.find(
      (p) => Number(p.id) === Number(ticket.patient)
    );

    if (!patient) {
      return "";
    }

    return patient.patient_code || "";
  };

  // ============================================================
  // NOM DU DOCTEUR
  // ============================================================

  const getDoctorName = (ticket) => {
    // Le serializer du ticket fournit directement doctor_name
    if (ticket.doctor_name) {
      return ticket.doctor_name;
    }

    const doctor = doctors.find(
      (d) => Number(d.id) === Number(ticket.doctor)
    );

    if (!doctor) {
      return "Docteur inconnu";
    }

    // Structure réelle de DoctorSerializer :
    // doctor.user.first_name
    // doctor.user.last_name

    const firstName = doctor.user?.first_name || "";
    const lastName = doctor.user?.last_name || "";

    const fullName = `${firstName} ${lastName}`.trim();

    if (fullName) {
      return `Dr ${fullName}`;
    }

    return `Docteur #${doctor.id}`;
  };

  // ============================================================
  // SPECIALITE DU DOCTEUR
  // ============================================================

  const getDoctorSpecialty = (ticket) => {
    const doctor = doctors.find(
      (d) => Number(d.id) === Number(ticket.doctor)
    );

    if (!doctor) {
      return "";
    }

    return doctor.specialty_name || "";
  };

  // ============================================================
  // STATUT
  // ============================================================

  const getStatusLabel = (statut) => {
    switch (statut) {
      case "EN_ATTENTE":
        return "En attente";

      case "EN_COURS":
        return "En cours";

      case "TERMINE":
        return "Terminé";

      case "ANNULE":
        return "Annulé";

      default:
        return statut || "Inconnu";
    }
  };

  // ============================================================
  // CLASSE CSS STATUT
  // ============================================================

  const getStatusClass = (statut) => {
    switch (statut) {
      case "EN_ATTENTE":
        return "ticket-status waiting";

      case "EN_COURS":
        return "ticket-status progress";

      case "TERMINE":
        return "ticket-status done";

      case "ANNULE":
        return "ticket-status cancelled";

      default:
        return "ticket-status";
    }
  };

  // ============================================================
  // OUVRIR LE FORMULAIRE
  // ============================================================

  const openForm = () => {
    setError("");
    setSuccess("");

    setForm({
      patient: "",
      doctor: "",
    });

    setShowForm(true);
  };

  // ============================================================
  // FERMER LE FORMULAIRE
  // ============================================================

  const closeForm = () => {
    if (saving) {
      return;
    }

    setShowForm(false);

    setForm({
      patient: "",
      doctor: "",
    });
  };

  // ============================================================
  // AFFICHAGE
  // ============================================================

  return (
    <div className="tickets-page">

      {/* ======================================================
          EN-TETE
      ====================================================== */}

      <div className="tickets-header">
        <div>
          <h1>Gestion des tickets</h1>

          <p>
            Création et suivi des bons de consultation des
            patients.
          </p>
        </div>

        <div className="tickets-actions">

          <button
            type="button"
            className="btn secondary"
            onClick={loadData}
            disabled={loading}
          >
            🔄 Actualiser
          </button>

          <button
            type="button"
            className="btn secondary"
            onClick={callNext}
            disabled={loading || tickets.length === 0}
          >
            📢 Appeler le prochain
          </button>

          <button
            type="button"
            className="btn primary"
            onClick={openForm}
          >
            + Nouveau ticket
          </button>

        </div>
      </div>

      {/* ======================================================
          MESSAGES
      ====================================================== */}

      {error && (
        <div className="ticket-error">
          <strong>Erreur :</strong> {error}
        </div>
      )}

      {success && (
        <div className="ticket-success">
          <strong>Succès :</strong> {success}
        </div>
      )}

      {/* ======================================================
          INFORMATIONS
      ====================================================== */}

      <div className="ticket-info-grid">

        <div className="card ticket-info-card">
          <div className="ticket-info-icon">
            👥
          </div>

          <div>
            <strong>{patients.length}</strong>
            <span>Patients disponibles</span>
          </div>
        </div>

        <div className="card ticket-info-card">
          <div className="ticket-info-icon">
            👨‍⚕️
          </div>

          <div>
            <strong>{doctors.length}</strong>
            <span>Docteurs disponibles</span>
          </div>
        </div>

        <div className="card ticket-info-card">
          <div className="ticket-info-icon">
            🎫
          </div>

          <div>
            <strong>{tickets.length}</strong>
            <span>Tickets</span>
          </div>
        </div>

        <div className="card ticket-info-card">
          <div className="ticket-info-icon">
            ⏳
          </div>

          <div>
            <strong>
              {
                tickets.filter(
                  (ticket) =>
                    ticket.statut === "EN_ATTENTE"
                ).length
              }
            </strong>

            <span>En attente</span>
          </div>
        </div>

      </div>

      {/* ======================================================
          FORMULAIRE NOUVEAU TICKET
      ====================================================== */}

      {showForm && (
        <div className="card ticket-form">

          <div className="ticket-form-header">

            <div>
              <h2>Nouveau bon de consultation</h2>

              <p>
                Sélectionnez le patient et le docteur.
                Le numéro du ticket sera généré
                automatiquement.
              </p>
            </div>

            <button
              type="button"
              className="btn secondary"
              onClick={closeForm}
              disabled={saving}
            >
              Fermer
            </button>

          </div>

          <form onSubmit={handleSubmit}>

            <div className="ticket-form-grid">

              {/* PATIENT */}

              <div>
                <label htmlFor="ticket-patient">
                  Patient
                </label>

                <select
                  id="ticket-patient"
                  value={form.patient}
                  onChange={(e) =>
                    setForm((previous) => ({
                      ...previous,
                      patient: e.target.value,
                    }))
                  }
                  required
                >
                  <option value="">
                    -- Sélectionner un patient --
                  </option>

                  {patients.length === 0 ? (
                    <option value="" disabled>
                      Aucun patient disponible
                    </option>
                  ) : (
                    patients.map((patient) => (
                      <option
                        key={patient.id}
                        value={patient.id}
                      >
                        {patient.full_name ||
                          `${patient.user?.first_name || ""} ${
                            patient.user?.last_name || ""
                          }`.trim() ||
                          `Patient #${patient.id}`}
                        {patient.patient_code
                          ? ` - ${patient.patient_code}`
                          : ""}
                      </option>
                    ))
                  )}
                </select>

                {patients.length === 0 && !loading && (
                  <small className="field-warning">
                    Aucun patient n'a été récupéré depuis
                    l'API.
                  </small>
                )}
              </div>

              {/* DOCTEUR */}

              <div>
                <label htmlFor="ticket-doctor">
                  Docteur
                </label>

                <select
                  id="ticket-doctor"
                  value={form.doctor}
                  onChange={(e) =>
                    setForm((previous) => ({
                      ...previous,
                      doctor: e.target.value,
                    }))
                  }
                  required
                >
                  <option value="">
                    -- Sélectionner un docteur --
                  </option>

                  {doctors.length === 0 ? (
                    <option value="" disabled>
                      Aucun docteur disponible
                    </option>
                  ) : (
                    doctors.map((doctor) => {

                      const doctorName =
                        `${doctor.user?.first_name || ""} ${
                          doctor.user?.last_name || ""
                        }`.trim();

                      return (
                        <option
                          key={doctor.id}
                          value={doctor.id}
                        >
                          {doctorName
                            ? `Dr ${doctorName}`
                            : `Docteur #${doctor.id}`}
                          {doctor.specialty_name
                            ? ` - ${doctor.specialty_name}`
                            : ""}
                        </option>
                      );
                    })
                  )}
                </select>

                {doctors.length === 0 && !loading && (
                  <small className="field-warning">
                    Aucun docteur n'a été récupéré depuis
                    l'API.
                  </small>
                )}
              </div>

            </div>

            {/* RESUME */}

            {form.patient && form.doctor && (
              <div className="ticket-preview">

                <h3>
                  Aperçu du ticket
                </h3>

                <div className="ticket-preview-grid">

                  <div>
                    <span>Patient</span>
                    <strong>
                      {getPatientName({
                        patient: form.patient,
                      })}
                    </strong>
                  </div>

                  <div>
                    <span>Docteur</span>
                    <strong>
                      {getDoctorName({
                        doctor: form.doctor,
                      })}
                    </strong>
                  </div>

                  <div>
                    <span>Spécialité</span>
                    <strong>
                      {getDoctorSpecialty({
                        doctor: form.doctor,
                      }) || "—"}
                    </strong>
                  </div>

                </div>

              </div>
            )}

            <div className="ticket-form-submit">

              <button
                className="btn primary"
                type="submit"
                disabled={
                  saving ||
                  !form.patient ||
                  !form.doctor
                }
              >
                {saving
                  ? "Création..."
                  : "🎫 Créer le ticket"}
              </button>

            </div>

          </form>

        </div>
      )}

      {/* ======================================================
          LISTE DES TICKETS
      ====================================================== */}

      <div className="card">

        <div className="ticket-list-header">

          <div>
            <h2>Liste des tickets</h2>

            <p>
              Suivi des bons de consultation.
            </p>
          </div>

          <span className="ticket-count">
            {tickets.length} ticket
            {tickets.length > 1 ? "s" : ""}
          </span>

        </div>

        {loading ? (

          <div className="ticket-loading">
            <div className="loading-spinner"></div>

            <p>
              Chargement des tickets, patients et
              docteurs...
            </p>
          </div>

        ) : tickets.length === 0 ? (

          <div className="ticket-empty">

            <div className="empty-icon">
              🎫
            </div>

            <h3>
              Aucun ticket
            </h3>

            <p>
              Aucun bon de consultation n'a encore
              été créé.
            </p>

            <button
              type="button"
              className="btn primary"
              onClick={openForm}
            >
              + Créer le premier ticket
            </button>

          </div>

        ) : (

          <div className="table-container">

            <table>

              <thead>
                <tr>
                  <th>N° Ticket</th>
                  <th>Patient</th>
                  <th>Docteur</th>
                  <th>Spécialité</th>
                  <th>Date</th>
                  <th>Heure</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>

                {tickets.map((ticket) => (

                  <tr key={ticket.id}>

                    {/* NUMERO */}

                    <td>
                      <strong className="ticket-number">
                        {ticket.numero || "—"}
                      </strong>
                    </td>

                    {/* PATIENT */}

                    <td>
                      <div className="person-cell">

                        <strong>
                          {getPatientName(ticket)}
                        </strong>

                        {getPatientCode(ticket) && (
                          <small>
                            {getPatientCode(ticket)}
                          </small>
                        )}

                      </div>
                    </td>

                    {/* DOCTEUR */}

                    <td>
                      <strong>
                        {getDoctorName(ticket)}
                      </strong>
                    </td>

                    {/* SPECIALITE */}

                    <td>
                      {getDoctorSpecialty(ticket) || "—"}
                    </td>

                    {/* DATE */}

                    <td>
                      {ticket.date || "—"}
                    </td>

                    {/* HEURE */}

                    <td>
                      {ticket.heure || "—"}
                    </td>

                    {/* STATUT */}

                    <td>

                      <span
                        className={getStatusClass(
                          ticket.statut
                        )}
                      >
                        {getStatusLabel(
                          ticket.statut
                        )}
                      </span>

                    </td>

                    {/* ACTIONS */}

                    <td>

                      <div className="ticket-row-actions">

                        {ticket.statut ===
                          "EN_ATTENTE" && (
                          <button
                            type="button"
                            className="btn secondary small"
                            onClick={() =>
                              updateStatus(
                                ticket.id,
                                "EN_COURS"
                              )
                            }
                          >
                            📢 Appeler
                          </button>
                        )}

                        {ticket.statut ===
                          "EN_COURS" && (
                          <button
                            type="button"
                            className="btn primary small"
                            onClick={() =>
                              updateStatus(
                                ticket.id,
                                "TERMINE"
                              )
                            }
                          >
                            ✓ Terminer
                          </button>
                        )}

                        {(ticket.statut ===
                          "EN_ATTENTE" ||
                          ticket.statut ===
                            "EN_COURS") && (
                          <button
                            type="button"
                            className="btn danger small"
                            onClick={() =>
                              updateStatus(
                                ticket.id,
                                "ANNULE"
                              )
                            }
                          >
                            ✕ Annuler
                          </button>
                        )}

                        <button
                          type="button"
                          className="btn secondary small"
                          onClick={() =>
                            printTicket(ticket)
                          }
                        >
                          🖨️ Imprimer
                        </button>

                      </div>

                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        )}

      </div>

      {/* ======================================================
          STYLES
      ====================================================== */}

      <style>{`

        .tickets-page {
          width: 100%;
          padding-bottom: 30px;
        }

        .tickets-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          margin-bottom: 25px;
          flex-wrap: wrap;
        }

        .tickets-header h1 {
          margin: 0 0 8px;
        }

        .tickets-header p {
          margin: 0;
          color: #6b7280;
        }

        .tickets-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .ticket-error,
        .ticket-success {
          margin-bottom: 20px;
          padding: 15px;
          border-radius: 8px;
        }

        .ticket-error {
          border-left: 4px solid #dc2626;
          background: #fef2f2;
          color: #991b1b;
        }

        .ticket-success {
          border-left: 4px solid #16a34a;
          background: #f0fdf4;
          color: #166534;
        }

        .ticket-info-grid {
          display: grid;
          grid-template-columns:
            repeat(
              4,
              minmax(180px, 1fr)
            );
          gap: 15px;
          margin-bottom: 25px;
        }

        .ticket-info-card {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 20px;
        }

        .ticket-info-icon {
          width: 45px;
          height: 45px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          background: #f3f4f6;
          font-size: 22px;
        }

        .ticket-info-card strong {
          display: block;
          font-size: 24px;
          margin-bottom: 3px;
        }

        .ticket-info-card span {
          display: block;
          color: #6b7280;
          font-size: 13px;
        }

        .ticket-form {
          margin-bottom: 25px;
          padding: 25px;
        }

        .ticket-form-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 25px;
        }

        .ticket-form-header h2 {
          margin: 0 0 6px;
        }

        .ticket-form-header p {
          margin: 0;
          color: #6b7280;
        }

        .ticket-form-grid {
          display: grid;
          grid-template-columns:
            repeat(
              2,
              minmax(250px, 1fr)
            );
          gap: 20px;
        }

        .ticket-form label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
        }

        .ticket-form select {
          width: 100%;
          box-sizing: border-box;
          padding: 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          background: white;
          font-size: 14px;
          outline: none;
        }

        .ticket-form select:focus {
          border-color: #2563eb;
        }

        .field-warning {
          display: block;
          margin-top: 7px;
          color: #b45309;
          font-size: 12px;
        }

        .ticket-preview {
          margin-top: 25px;
          padding: 18px;
          border-radius: 10px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
        }

        .ticket-preview h3 {
          margin: 0 0 15px;
        }

        .ticket-preview-grid {
          display: grid;
          grid-template-columns:
            repeat(
              3,
              minmax(180px, 1fr)
            );
          gap: 20px;
        }

        .ticket-preview-grid span {
          display: block;
          font-size: 12px;
          color: #6b7280;
          margin-bottom: 5px;
        }

        .ticket-preview-grid strong {
          display: block;
        }

        .ticket-form-submit {
          margin-top: 25px;
        }

        .ticket-list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          margin-bottom: 20px;
        }

        .ticket-list-header h2 {
          margin: 0 0 5px;
        }

        .ticket-list-header p {
          margin: 0;
          color: #6b7280;
        }

        .ticket-count {
          padding: 8px 13px;
          border-radius: 20px;
          background: #f3f4f6;
          color: #374151;
          font-weight: 600;
          white-space: nowrap;
        }

        .ticket-loading {
          min-height: 200px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #6b7280;
        }

        .loading-spinner {
          width: 35px;
          height: 35px;
          border: 4px solid #e5e7eb;
          border-top-color: #2563eb;
          border-radius: 50%;
          animation: ticket-spin 0.8s linear infinite;
          margin-bottom: 15px;
        }

        @keyframes ticket-spin {
          to {
            transform: rotate(360deg);
          }
        }

        .ticket-empty {
          text-align: center;
          padding: 60px 20px;
        }

        .empty-icon {
          font-size: 45px;
          margin-bottom: 15px;
        }

        .ticket-empty h3 {
          margin: 0 0 8px;
        }

        .ticket-empty p {
          color: #6b7280;
          margin-bottom: 20px;
        }

        .table-container {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th,
        td {
          padding: 13px 12px;
          text-align: left;
          border-bottom: 1px solid #e5e7eb;
          white-space: nowrap;
        }

        th {
          font-size: 13px;
          color: #4b5563;
          background: #f9fafb;
        }

        td {
          font-size: 14px;
        }

        .ticket-number {
          font-family: monospace;
          font-size: 14px;
        }

        .person-cell strong {
          display: block;
        }

        .person-cell small {
          display: block;
          margin-top: 3px;
          color: #6b7280;
        }

        .ticket-status {
          display: inline-block;
          padding: 5px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }

        .ticket-status.waiting {
          background: #fff7ed;
          color: #c2410c;
        }

        .ticket-status.progress {
          background: #eff6ff;
          color: #1d4ed8;
        }

        .ticket-status.done {
          background: #f0fdf4;
          color: #15803d;
        }

        .ticket-status.cancelled {
          background: #fef2f2;
          color: #b91c1c;
        }

        .ticket-row-actions {
          display: flex;
          gap: 7px;
          flex-wrap: wrap;
        }

        .btn.small {
          padding: 7px 10px;
          font-size: 12px;
        }

        .btn.danger {
          background: #dc2626;
          color: white;
          border: none;
        }

        .btn.danger:hover {
          background: #b91c1c;
        }

        @media (max-width: 1100px) {
          .ticket-info-grid {
            grid-template-columns:
              repeat(
                2,
                minmax(180px, 1fr)
              );
          }
        }

        @media (max-width: 800px) {
          .ticket-form-grid {
            grid-template-columns: 1fr;
          }

          .ticket-preview-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 700px) {
          .tickets-header {
            align-items: flex-start;
          }

          .tickets-actions {
            width: 100%;
          }

          .tickets-actions button {
            flex: 1;
          }

          .ticket-form-header {
            flex-direction: column;
          }

          .ticket-info-grid {
            grid-template-columns: 1fr;
          }

          .ticket-list-header {
            align-items: flex-start;
            flex-direction: column;
          }
        }

      `}</style>

    </div>
  );
}

export default Tickets;
