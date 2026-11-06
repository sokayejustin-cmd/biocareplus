import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, fetchAll } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Modal, confirmBox } from "../ui.jsx";

const ROLE_LABELS = {
  admin: "Administrateur",
  doctor: "Docteur",
  nurse: "Infirmier",
  receptionist: "Réceptionniste",
  patient: "Patient",
};

const NEW_ADMIN = {
  username: "",
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  password: "",
  role: "admin",
  is_active: true,
};

function errorText(err) {
  const p = err.payload;
  if (p && typeof p === "object") return Object.values(p).flat().join(" ") || err.message;
  return err.message;
}

export default function Users() {
  const { user: me, notify } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState(null);

  async function load() {
    setLoading(true);
    try {
      setUsers(await fetchAll("/users/"));
    } catch (err) {
      notify("error", errorText(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save(e) {
    e.preventDefault();
    const { id, role: r, password, ...rest } = editing;
    const body = { ...rest };
    if (password) body.password = password;
    try {
      if (id) {
        await api(`/users/${id}/`, { method: "PATCH", body });
        notify("success", "Utilisateur modifié.");
      } else {
        await api("/users/", { method: "POST", body: { ...body, role: r } });
        notify("success", "Administrateur créé.");
      }
      setEditing(null);
      load();
    } catch (err) {
      notify("error", errorText(err));
    }
  }

  async function toggleActive(u) {
    try {
      if (u.is_active) {
        if (!confirmBox(`Désactiver le compte de ${u.first_name} ${u.last_name} ?`)) return;
        await api(`/users/${u.id}/`, { method: "DELETE" });
        notify("success", "Compte désactivé.");
      } else {
        await api(`/users/${u.id}/`, { method: "PATCH", body: { is_active: true } });
        notify("success", "Compte réactivé.");
      }
      load();
    } catch (err) {
      notify("error", errorText(err));
    }
  }

  const q = search.toLowerCase();
  const shown = users.filter((u) => {
    const text = `${u.username} ${u.first_name} ${u.last_name} ${u.email} ${u.phone}`.toLowerCase();
    if (q && !text.includes(q)) return false;
    if (role && u.role !== role) return false;
    if (status === "active" && !u.is_active) return false;
    if (status === "inactive" && u.is_active) return false;
    return true;
  });

  const set = (k) => (e) =>
    setEditing({ ...editing, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  return (
    <div>
      <h1>Gestion des utilisateurs</h1>
      <p style={{ color: "var(--muted)" }}>
        {users.length} comptes · {users.filter((u) => u.is_active).length} actifs
      </p>

      <div className="toolbar">
        <input className="input" placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">Tous les rôles</option>
          {Object.entries(ROLE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tous les statuts</option>
          <option value="active">Actifs</option>
          <option value="inactive">Inactifs</option>
        </select>
        <button className="btn" onClick={() => setEditing({ ...NEW_ADMIN })}>+ Nouvel administrateur</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Utilisateur</th><th>Email</th><th>Téléphone</th><th>Rôle</th>
              <th>Dernière connexion</th><th>Statut</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7}>Chargement...</td></tr>
            ) : shown.length === 0 ? (
              <tr><td colSpan={7}>Aucun utilisateur trouvé.</td></tr>
            ) : (
              shown.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.first_name} {u.last_name}</strong>
                    <br />
                    <small style={{ color: "var(--muted)" }}>@{u.username}</small>
                    {u.must_change_password && <> <span className="badge warn">MDP provisoire</span></>}
                  </td>
                  <td>{u.email || "—"}</td>
                  <td>{u.phone || "—"}</td>
                  <td><span className="badge">{ROLE_LABELS[u.role] || u.role}</span></td>
                  <td>{u.last_login ? new Date(u.last_login).toLocaleString("fr-FR") : "Jamais"}</td>
                  <td>
                    <span className={`badge ${u.is_active ? "" : "danger"}`}>
                      {u.is_active ? "Actif" : "Inactif"}
                    </span>
                  </td>
                  <td style={{ display: "flex", gap: 6 }}>
                    <button className="btn secondary" onClick={() => setEditing({ ...u, password: "" })}>Modifier</button>
                    {u.id !== me?.id && (
                      <button className={`btn ${u.is_active ? "danger" : "green"}`} onClick={() => toggleActive(u)}>
                        {u.is_active ? "Désactiver" : "Réactiver"}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!editing}
        title={editing?.id ? `Modifier @${editing.username}` : "Nouvel administrateur"}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <form onSubmit={save}>
            {!editing.id && (
              <p style={{ color: "var(--muted)", fontSize: 13 }}>
                Pour les autres rôles, passez par les pages{" "}
                <Link to="/app/doctors">Docteurs</Link>, <Link to="/app/nurses">Infirmiers</Link>,{" "}
                <Link to="/app/receptionists">Réceptionnistes</Link> ou <Link to="/app/patients">Patients</Link>.
              </p>
            )}
            <div className="field">
              <label>Identifiant</label>
              <input className="input" required value={editing.username} onChange={set("username")} />
            </div>
            <div className="grid-2">
              <div className="field">
                <label>Prénom</label>
                <input className="input" value={editing.first_name} onChange={set("first_name")} />
              </div>
              <div className="field">
                <label>Nom</label>
                <input className="input" value={editing.last_name} onChange={set("last_name")} />
              </div>
            </div>
            <div className="grid-2">
              <div className="field">
                <label>Email</label>
                <input className="input" type="email" value={editing.email} onChange={set("email")} />
              </div>
              <div className="field">
                <label>Téléphone</label>
                <input className="input" value={editing.phone || ""} onChange={set("phone")} />
              </div>
            </div>
            <div className="field">
              <label>{editing.id ? "Nouveau mot de passe (laisser vide pour ne pas changer)" : "Mot de passe provisoire"}</label>
              <input className="input" type="password" required={!editing.id} value={editing.password} onChange={set("password")} />
            </div>
            {editing.id && (
              <p style={{ fontSize: 13 }}>
                Rôle : <span className="badge">{ROLE_LABELS[editing.role]}</span>
              </p>
            )}
            <button className="btn">Enregistrer</button>
          </form>
        )}
      </Modal>
    </div>
  );
}
