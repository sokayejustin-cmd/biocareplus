import { useEffect, useState } from "react";
import { api, unwrap } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Modal, confirmBox } from "../ui.jsx";

const empty = {
  patient_code: "",
  date_of_birth: "",
  sex: "F",
  address: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",

  user: {
    username: "",
    password: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
  },

  medical_record: {
    blood_type: "",
    allergies: "",
    medical_history: "",
    surgical_history: "",
    current_treatments: "",
    observations: "",
  },
};

export default function Patients({ create }) {
  const { user, notify } = useAuth();

  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(Boolean(create));
  const [form, setForm] = useState(empty);
  const [detail, setDetail] = useState(null);

  // =========================
  // CHARGEMENT DES PATIENTS
  // =========================
  const load = () =>
    api(`/patients/${q ? `?search=${encodeURIComponent(q)}` : ""}`).then(
      (d) => setRows(unwrap(d))
    );

  useEffect(() => {
    load().catch((error) => {
      console.error("Erreur chargement patients :", error);
      notify("error", "Impossible de charger les patients.");
    });
  }, [q]);

  // =========================
  // DROITS
  // =========================
  const canEdit = ["admin", "receptionist"].includes(user.role);

  // =========================
  // MODIFICATION D'UN CHAMP
  // =========================
  const updateField = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const updateUserField = (field, value) => {
    setForm((prev) => ({
      ...prev,
      user: {
        ...prev.user,
        [field]: value,
      },
    }));
  };

  const updateMedicalField = (field, value) => {
    setForm((prev) => ({
      ...prev,
      medical_record: {
        ...prev.medical_record,
        [field]: value,
      },
    }));
  };

  // =========================
  // ENREGISTREMENT PATIENT
  // =========================
  const save = async (e) => {
    e.preventDefault();

    try {
      console.log("Données envoyées :", form);

      const response = await api("/patients/", {
        method: "POST",
        body: form,
      });

      console.log("Patient créé :", response);

      notify("success", "Patient enregistré.");

      setOpen(false);
      setForm(empty);

      await load();
    } catch (error) {
      console.error("Erreur création patient :", error);

      const data = error?.response?.data || error?.data;

      console.error("Détail erreur API :", data);

      let message = "Enregistrement impossible.";

      if (data) {
        if (typeof data === "string") {
          message = data;
        } else if (data.detail) {
          message = data.detail;
        } else {
          message = Object.entries(data)
            .map(([field, errors]) => {
              const text = Array.isArray(errors)
                ? errors.join(", ")
                : typeof errors === "object"
                ? JSON.stringify(errors)
                : String(errors);

              return `${field} : ${text}`;
            })
            .join(" | ");
        }
      }

      notify("error", message);
    }
  };

  // =========================
  // SUPPRESSION
  // =========================
  const remove = async (id) => {
    if (!confirmBox("Désactiver / supprimer ce patient ?")) return;

    try {
      await api(`/patients/${id}/`, {
        method: "DELETE",
      });

      notify("success", "Patient retiré.");

      await load();
    } catch (error) {
      console.error("Erreur suppression :", error);
      notify("error", "Suppression non autorisée.");
    }
  };

  // =========================
  // AFFICHER LE DOSSIER
  // =========================
  const showDossier = async (p) => {
    try {
      const records = unwrap(
        await api(`/medical-records/?patient=${p.id}`)
      );

      const appts = unwrap(
        await api(`/appointments/?patient=${p.id}`)
      );

      let cons = [];

      try {
        cons = unwrap(
          await api(`/consultations/?patient=${p.id}`)
        );
      } catch (error) {
        console.warn("Consultations indisponibles :", error);
      }

      setDetail({
        patient: p,
        record: records[0] || null,
        appts,
        cons,
      });
    } catch (error) {
      console.error("Erreur dossier patient :", error);

      setDetail({
        patient: p,
        record: null,
        appts: [],
        cons: [],
      });
    }
  };

  // =========================
  // RENDU
  // =========================
  return (
    <div>
      <h1>Patients</h1>

      {/* BARRE DE RECHERCHE */}
      <div className="toolbar">
        <input
          className="input"
          placeholder="Recherche nom ou identifiant"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        {canEdit && (
          <button
            className="btn"
            onClick={() => {
              setForm(empty);
              setOpen(true);
            }}
          >
            Nouveau patient
          </button>
        )}
      </div>

      {/* LISTE DES PATIENTS */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Nom</th>
              <th>Identifiant</th>
              <th>Tél.</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: "center" }}>
                  Aucun patient trouvé.
                </td>
              </tr>
            ) : (
              rows.map((p) => (
                <tr key={p.id}>
                  <td>{p.patient_code}</td>

                  <td>{p.full_name}</td>

                  <td>{p.user?.username || "-"}</td>

                  <td>{p.user?.phone || "-"}</td>

                  <td>
                    <button
                      className="btn secondary"
                      onClick={() => showDossier(p)}
                    >
                      Dossier
                    </button>

                    {user.role === "admin" && (
                      <button
                        className="btn danger"
                        style={{ marginLeft: 8 }}
                        onClick={() => remove(p.id)}
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

      {/* =========================
          FORMULAIRE NOUVEAU PATIENT
          ========================= */}
      {open && canEdit && (
        <Modal
          title="Nouveau patient"
          onClose={() => setOpen(false)}
        >
          <form onSubmit={save}>
            <h3>Informations du patient</h3>

            <div className="grid-2">
              {/* CODE PATIENT */}
              <div className="field">
                <label>Code patient *</label>

                <input
                  className="input"
                  value={form.patient_code}
                  onChange={(e) =>
                    updateField("patient_code", e.target.value)
                  }
                  placeholder="Ex : PAT001"
                  required
                />
              </div>

              {/* IDENTIFIANT */}
              <div className="field">
                <label>Identifiant *</label>

                <input
                  className="input"
                  value={form.user.username}
                  onChange={(e) =>
                    updateUserField("username", e.target.value)
                  }
                  placeholder="Identifiant de connexion"
                  required
                />
              </div>

              {/* MOT DE PASSE */}
              <div className="field">
                <label>Mot de passe *</label>

                <input
                  className="input"
                  type="password"
                  value={form.user.password}
                  onChange={(e) =>
                    updateUserField("password", e.target.value)
                  }
                  placeholder="Mot de passe"
                  required
                />
              </div>

              {/* PRENOM */}
              <div className="field">
                <label>Prénom</label>

                <input
                  className="input"
                  value={form.user.first_name}
                  onChange={(e) =>
                    updateUserField("first_name", e.target.value)
                  }
                />
              </div>

              {/* NOM */}
              <div className="field">
                <label>Nom</label>

                <input
                  className="input"
                  value={form.user.last_name}
                  onChange={(e) =>
                    updateUserField("last_name", e.target.value)
                  }
                />
              </div>

              {/* EMAIL */}
              <div className="field">
                <label>Email</label>

                <input
                  className="input"
                  type="email"
                  value={form.user.email}
                  onChange={(e) =>
                    updateUserField("email", e.target.value)
                  }
                />
              </div>

              {/* TELEPHONE */}
              <div className="field">
                <label>Téléphone</label>

                <input
                  className="input"
                  value={form.user.phone}
                  onChange={(e) =>
                    updateUserField("phone", e.target.value)
                  }
                />
              </div>

              {/* DATE DE NAISSANCE */}
              <div className="field">
                <label>Date de naissance</label>

                <input
                  className="input"
                  type="date"
                  value={form.date_of_birth}
                  onChange={(e) =>
                    updateField("date_of_birth", e.target.value)
                  }
                />
              </div>

              {/* SEXE */}
              <div className="field">
                <label>Sexe</label>

                <select
                  value={form.sex}
                  onChange={(e) =>
                    updateField("sex", e.target.value)
                  }
                >
                  <option value="F">Féminin</option>
                  <option value="M">Masculin</option>
                  <option value="O">Autre</option>
                </select>
              </div>
            </div>

            {/* ADRESSE */}
            <div className="field">
              <label>Adresse</label>

              <input
                className="input"
                value={form.address}
                onChange={(e) =>
                  updateField("address", e.target.value)
                }
                placeholder="Adresse du patient"
              />
            </div>

            {/* CONTACT D'URGENCE */}
            <h3>Contact d'urgence</h3>

            <div className="grid-2">
              <div className="field">
                <label>Personne à contacter</label>

                <input
                  className="input"
                  value={form.emergency_contact_name}
                  onChange={(e) =>
                    updateField(
                      "emergency_contact_name",
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="field">
                <label>Téléphone d'urgence</label>

                <input
                  className="input"
                  value={form.emergency_contact_phone}
                  onChange={(e) =>
                    updateField(
                      "emergency_contact_phone",
                      e.target.value
                    )
                  }
                />
              </div>
            </div>

            {/* =========================
                DOSSIER MEDICAL
                ========================= */}
            <h3>Dossier médical</h3>

            <div className="grid-2">
              {/* GROUPE SANGUIN */}
              <div className="field">
                <label>Groupe sanguin</label>

                <select
                  value={form.medical_record.blood_type}
                  onChange={(e) =>
                    updateMedicalField(
                      "blood_type",
                      e.target.value
                    )
                  }
                >
                  <option value="">Non renseigné</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>

              {/* ALLERGIES */}
              <div className="field">
                <label>Allergies</label>

                <input
                  className="input"
                  value={form.medical_record.allergies}
                  onChange={(e) =>
                    updateMedicalField(
                      "allergies",
                      e.target.value
                    )
                  }
                  placeholder="Ex : pénicilline, aucune..."
                />
              </div>
            </div>

            {/* ANTECEDENTS */}
            <div className="field">
              <label>Antécédents médicaux</label>

              <textarea
                className="input"
                rows="3"
                value={form.medical_record.medical_history}
                onChange={(e) =>
                  updateMedicalField(
                    "medical_history",
                    e.target.value
                  )
                }
                placeholder="Antécédents médicaux..."
              />
            </div>

            {/* CHIRURGICAUX */}
            <div className="field">
              <label>Antécédents chirurgicaux</label>

              <textarea
                className="input"
                rows="3"
                value={form.medical_record.surgical_history}
                onChange={(e) =>
                  updateMedicalField(
                    "surgical_history",
                    e.target.value
                  )
                }
                placeholder="Opérations ou interventions..."
              />
            </div>

            {/* TRAITEMENTS */}
            <div className="field">
              <label>Traitements actuels</label>

              <textarea
                className="input"
                rows="3"
                value={form.medical_record.current_treatments}
                onChange={(e) =>
                  updateMedicalField(
                    "current_treatments",
                    e.target.value
                  )
                }
                placeholder="Traitements actuellement suivis..."
              />
            </div>

            {/* OBSERVATIONS */}
            <div className="field">
              <label>Observations</label>

              <textarea
                className="input"
                rows="3"
                value={form.medical_record.observations}
                onChange={(e) =>
                  updateMedicalField(
                    "observations",
                    e.target.value
                  )
                }
                placeholder="Observations complémentaires..."
              />
            </div>

            {/* BOUTONS */}
            <div style={{ marginTop: 20 }}>
              <button
                type="submit"
                className="btn"
              >
                Enregistrer le patient
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

      {/* =========================
          DOSSIER DU PATIENT
          ========================= */}
      {detail && (
        <Modal
          title={`Dossier ${detail.patient.full_name}`}
          onClose={() => setDetail(null)}
        >
          <p>
            <b>Code :</b>{" "}
            {detail.patient.patient_code}
            {" · "}
            <b>Email :</b>{" "}
            {detail.patient.user?.email || "-"}
          </p>

          <p>
            <b>Téléphone :</b>{" "}
            {detail.patient.user?.phone || "-"}
          </p>

          <p>
            <b>Adresse :</b>{" "}
            {detail.patient.address || "-"}
          </p>

          {detail.record && (
            <div
              className="card"
              style={{ boxShadow: "none" }}
            >
              <h3>Informations médicales</h3>

              <p>
                <b>Groupe sanguin :</b>{" "}
                {detail.record.blood_type || "Non renseigné"}
              </p>

              <p>
                <b>Allergies :</b>{" "}
                {detail.record.allergies || "Aucune"}
              </p>

              <p>
                <b>Antécédents :</b>{" "}
                {detail.record.medical_history || "Aucun"}
              </p>

              <p>
                <b>Chirurgicaux :</b>{" "}
                {detail.record.surgical_history || "Aucun"}
              </p>

              <p>
                <b>Traitements :</b>{" "}
                {detail.record.current_treatments || "Aucun"}
              </p>

              <p>
                <b>Observations :</b>{" "}
                {detail.record.observations || "-"}
              </p>
            </div>
          )}

          <h4>Rendez-vous</h4>

          {detail.appts.length === 0 ? (
            <p>Aucun rendez-vous.</p>
          ) : (
            <ul>
              {detail.appts.map((a) => (
                <li key={a.id}>
                  {a.date} {a.time} —{" "}
                  {a.doctor_name}{" "}
                  ({a.status_label})
                </li>
              ))}
            </ul>
          )}

          <h4>Consultations</h4>

          {detail.cons.length === 0 ? (
            <p>Aucune consultation.</p>
          ) : (
            <ul>
              {detail.cons.map((c) => (
                <li key={c.id}>
                  {c.date || c.created_at || "Consultation"}
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </div>
  );
}