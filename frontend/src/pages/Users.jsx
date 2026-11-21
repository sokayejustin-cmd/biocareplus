import { useEffect, useState } from "react";
import { api, unwrap } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Modal } from "../ui.jsx";

const EDITABLE_FIELDS = ["first_name", "last_name", "email", "phone", "is_active"];

function errorMessage(err) {
  const payload = err?.payload;
  if (payload && typeof payload === "object") {
    const msgs = Object.entries(payload).map(([field, value]) =>
      field === "detail"
        ? String(value)
        : `${field} : ${Array.isArray(value) ? value.join(" ") : value}`
    );
    if (msgs.length) return msgs.join(" — ");
  }
  return "La modification a échoué.";
}

const ROLE_LABELS = {
  admin: "Administrateur",
  doctor: "Docteur",
  nurse: "Infirmier",
  receptionist: "Réceptionniste",
  patient: "Patient",
};

const EMPTY_NEW = {
  role: "doctor",
  username: "",
  password: "",
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  specialty: "",
  license_number: "",
  department: "",
  desk: "",
  patient_code: "",
  date_of_birth: "",
  sex: "",
};

// Chaque rôle passe par son propre point d'API pour que le profil associé
// (docteur, infirmier, etc.) soit créé en même temps que le compte.
function buildCreateRequest(f) {
  const user = {
    username: f.username.trim(),
    password: f.password,
    first_name: f.first_name.trim(),
    last_name: f.last_name.trim(),
    email: f.email.trim(),
    phone: f.phone.trim(),
  };
  switch (f.role) {
    case "doctor":
      return ["/doctors/", { user, specialty: f.specialty, license_number: f.license_number }];
    case "nurse":
      return ["/nurses/", { user, department: f.department }];
    case "receptionist":
      return ["/receptionists/", { user, desk: f.desk }];
    case "patient":
      return [
        "/patients/",
        {
          user,
          patient_code: f.patient_code.trim(),
          date_of_birth: f.date_of_birth || null,
          sex: f.sex,
        },
      ];
    default:
      return ["/users/", { ...user, role: "admin" }];
  }
}

// Les erreurs des comptes imbriqués arrivent sous la clé "user".
function flattenErrors(err) {
  const payload = err?.payload;
  if (payload && typeof payload === "object" && payload.user && typeof payload.user === "object") {
    const { user, ...rest } = payload;
    return errorMessage({ payload: { ...user, ...rest } });
  }
  return errorMessage(err);
}

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { user: currentUser, notify } = useAuth();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newForm, setNewForm] = useState(EMPTY_NEW);
  const [specialties, setSpecialties] = useState([]);

  function openCreate() {
    setNewForm(EMPTY_NEW);
    setCreating(true);
    if (!specialties.length) {
      api("/specialties/")
        .then((data) => setSpecialties(unwrap(data)))
        .catch(() => setSpecialties([]));
    }
  }

  const setNew = (field) => (e) => setNewForm({ ...newForm, [field]: e.target.value });

  async function saveCreate(e) {
    e.preventDefault();
    const [url, body] = buildCreateRequest(newForm);
    setSaving(true);
    try {
      const res = await api(url, { method: "POST", body });
      let msg = `Compte @${newForm.username.trim()} créé. Mot de passe provisoire, à changer à la première connexion.`;
      const wa = res?.credentials_whatsapp;
      if (wa?.status === "sent" && wa.provider !== "console") {
        msg += ` Identifiants envoyés par WhatsApp au ${wa.to_number}.`;
      }
      notify("success", msg);
      setCreating(false);
      loadUsers();
    } catch (err) {
      notify("error", flattenErrors(err));
    } finally {
      setSaving(false);
    }
  }

  function openEdit(user) {
    const initial = { password: "" };
    EDITABLE_FIELDS.forEach((f) => {
      initial[f] = user[f] ?? (f === "is_active" ? true : "");
    });
    setForm(initial);
    setEditing(user);
  }

  async function saveEdit(e) {
    e.preventDefault();
    const body = {};
    EDITABLE_FIELDS.forEach((f) => {
      body[f] = form[f];
    });
    if (form.password) body.password = form.password;

    setSaving(true);
    try {
      await api(`/users/${editing.id}/`, { method: "PATCH", body });
      notify("success", "Utilisateur mis à jour.");
      setEditing(null);
      loadUsers();
    } catch (err) {
      notify("error", errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const set = (field) => (e) =>
    setForm({
      ...form,
      [field]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    });

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      const data = await api("/users/");
      setUsers(unwrap(data));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  const filteredUsers = users.filter((user) => {
    const text = `
      ${user.username || ""}
      ${user.first_name || ""}
      ${user.last_name || ""}
      ${user.email || ""}
    `.toLowerCase();

    return text.includes(search.toLowerCase());
  });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Gestion des utilisateurs</h1>
          <p>Gérer les comptes utilisateurs de BIO CARE PLUS.</p>
        </div>

        <button type="button" className="btn primary" onClick={openCreate}>
          + Nouvel utilisateur
        </button>
      </div>

      <div className="card">
        <div style={{ marginBottom: 20 }}>
          <input
            type="text"
            className="input"
            placeholder="Rechercher un utilisateur..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <p>Chargement des utilisateurs...</p>
        ) : filteredUsers.length === 0 ? (
          <p>Aucun utilisateur trouvé.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Utilisateur</th>
                  <th>Email</th>
                  <th>Téléphone</th>
                  <th>Rôle</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>
                        {user.first_name} {user.last_name}
                      </strong>
                      <br />
                      <small>@{user.username}</small>
                    </td>

                    <td>{user.email}</td>

                    <td>{user.phone || "—"}</td>

                    <td>
                      {ROLE_LABELS[user.role] || user.role}
                    </td>

                    <td>
                      <span className={`badge ${user.is_active ? "" : "danger"}`}>
                        {user.is_active ? "Actif" : "Inactif"}
                      </span>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="btn secondary"
                        onClick={() => openEdit(user)}
                      >
                        Modifier
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {creating && (
        <Modal title="Nouvel utilisateur" onClose={() => setCreating(false)}>
          <form onSubmit={saveCreate}>
            <div className="grid-2">
              <div className="field">
                <label>Rôle *</label>
                <select className="input" value={newForm.role} onChange={setNew("role")}>
                  <option value="doctor">Docteur</option>
                  <option value="nurse">Infirmier</option>
                  <option value="receptionist">Réceptionniste</option>
                  <option value="patient">Patient</option>
                  <option value="admin">Administrateur</option>
                </select>
              </div>
              <div className="field">
                <label>Identifiant *</label>
                <input className="input" required autoComplete="off" value={newForm.username} onChange={setNew("username")} />
              </div>
              <div className="field">
                <label>Prénom *</label>
                <input className="input" required value={newForm.first_name} onChange={setNew("first_name")} />
              </div>
              <div className="field">
                <label>Nom *</label>
                <input className="input" required value={newForm.last_name} onChange={setNew("last_name")} />
              </div>
              <div className="field">
                <label>Email</label>
                <input className="input" type="email" value={newForm.email} onChange={setNew("email")} />
              </div>
              <div className="field">
                <label>Téléphone{newForm.role === "patient" ? " (WhatsApp)" : ""}</label>
                <input className="input" placeholder="+228 90 00 00 00" value={newForm.phone} onChange={setNew("phone")} />
              </div>
              <div className="field">
                <label>Mot de passe provisoire *</label>
                <input
                  className="input"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={newForm.password}
                  onChange={setNew("password")}
                />
              </div>

              {newForm.role === "doctor" && (
                <>
                  <div className="field">
                    <label>Spécialité *</label>
                    <select className="input" required value={newForm.specialty} onChange={setNew("specialty")}>
                      <option value="">— Choisir —</option>
                      {specialties.map((sp) => (
                        <option key={sp.id} value={sp.id}>{sp.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>N° d'ordre</label>
                    <input className="input" value={newForm.license_number} onChange={setNew("license_number")} />
                  </div>
                </>
              )}
              {newForm.role === "nurse" && (
                <div className="field">
                  <label>Service</label>
                  <input className="input" value={newForm.department} onChange={setNew("department")} />
                </div>
              )}
              {newForm.role === "receptionist" && (
                <div className="field">
                  <label>Poste / guichet</label>
                  <input className="input" value={newForm.desk} onChange={setNew("desk")} />
                </div>
              )}
              {newForm.role === "patient" && (
                <>
                  <div className="field">
                    <label>Code patient *</label>
                    <input className="input" required value={newForm.patient_code} onChange={setNew("patient_code")} />
                  </div>
                  <div className="field">
                    <label>Date de naissance</label>
                    <input className="input" type="date" value={newForm.date_of_birth} onChange={setNew("date_of_birth")} />
                  </div>
                  <div className="field">
                    <label>Sexe</label>
                    <select className="input" value={newForm.sex} onChange={setNew("sex")}>
                      <option value="">—</option>
                      <option value="M">Masculin</option>
                      <option value="F">Féminin</option>
                      <option value="O">Autre</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            <p className="muted" style={{ fontSize: 13 }}>
              L'utilisateur devra changer ce mot de passe à sa première connexion.
            </p>

            <button className="btn" disabled={saving}>
              {saving ? "Création…" : "Créer le compte"}
            </button>
          </form>
        </Modal>
      )}

      {editing && (
        <Modal
          title={`Modifier @${editing.username}`}
          onClose={() => setEditing(null)}
        >
          <form onSubmit={saveEdit}>
            <div className="grid-2">
              <div className="field">
                <label>Prénom</label>
                <input className="input" value={form.first_name} onChange={set("first_name")} />
              </div>
              <div className="field">
                <label>Nom</label>
                <input className="input" value={form.last_name} onChange={set("last_name")} />
              </div>
              <div className="field">
                <label>Email</label>
                <input className="input" type="email" value={form.email} onChange={set("email")} />
              </div>
              <div className="field">
                <label>Téléphone</label>
                <input className="input" value={form.phone} onChange={set("phone")} />
              </div>
              <div className="field">
                <label>Rôle</label>
                <input className="input" value={ROLE_LABELS[editing.role] || editing.role} disabled />
              </div>
              <div className="field">
                <label>Nouveau mot de passe</label>
                <input
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Laisser vide pour ne pas changer"
                  value={form.password}
                  onChange={set("password")}
                />
              </div>
            </div>

            <div className="field">
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={set("is_active")}
                  disabled={editing.id === currentUser?.id}
                />
                Compte actif
                {editing.id === currentUser?.id && (
                  <small>(vous ne pouvez pas désactiver votre propre compte)</small>
                )}
              </label>
            </div>

            <button className="btn" disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}