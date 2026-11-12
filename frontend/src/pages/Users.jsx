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

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { user: currentUser, notify } = useAuth();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

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

        <button className="btn primary">
          + Nouvel utilisateur
        </button>
      </div>

      <div className="card">
        <div style={{ marginBottom: 20 }}>
          <input
            type="text"
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
                      {user.is_active ? "Actif" : "Inactif"}
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