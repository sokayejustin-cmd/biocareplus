import { useEffect, useState } from "react";
import { api, fetchAll } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Modal, confirmBox } from "../ui.jsx";

const EMPTY = { name: "", description: "", is_active: true };

export default function Specialties() {
  const { notify } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null); // null = fermé, {} = formulaire

  async function load() {
    setLoading(true);
    try {
      setItems(await fetchAll("/specialties/"));
    } catch (err) {
      notify("error", err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save(e) {
    e.preventDefault();
    const { id, ...body } = editing;
    try {
      if (id) await api(`/specialties/${id}/`, { method: "PATCH", body });
      else await api("/specialties/", { method: "POST", body });
      notify("success", id ? "Spécialité modifiée." : "Spécialité créée.");
      setEditing(null);
      load();
    } catch (err) {
      notify("error", err.payload?.name?.[0] || err.message);
    }
  }

  async function remove(s) {
    if (!confirmBox(`Supprimer la spécialité « ${s.name} » ?`)) return;
    try {
      await api(`/specialties/${s.id}/`, { method: "DELETE" });
      notify("success", "Spécialité supprimée.");
      load();
    } catch {
      notify("error", "Impossible : des docteurs ou rendez-vous utilisent cette spécialité. Désactivez-la plutôt.");
    }
  }

  async function toggle(s) {
    try {
      await api(`/specialties/${s.id}/`, { method: "PATCH", body: { is_active: !s.is_active } });
      load();
    } catch (err) {
      notify("error", err.message);
    }
  }

  const shown = items.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <h1>Spécialités médicales</h1>
      <div className="toolbar">
        <input className="input" placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className="btn" onClick={() => setEditing({ ...EMPTY })}>+ Nouvelle spécialité</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Nom</th><th>Description</th><th>Statut</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4}>Chargement...</td></tr>
            ) : shown.length === 0 ? (
              <tr><td colSpan={4}>Aucune spécialité.</td></tr>
            ) : (
              shown.map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.name}</strong></td>
                  <td>{s.description || "—"}</td>
                  <td>
                    <span className={`badge ${s.is_active ? "" : "danger"}`}>
                      {s.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ display: "flex", gap: 6 }}>
                    <button className="btn secondary" onClick={() => setEditing({ ...s })}>Modifier</button>
                    <button className="btn secondary" onClick={() => toggle(s)}>
                      {s.is_active ? "Désactiver" : "Activer"}
                    </button>
                    <button className="btn danger" onClick={() => remove(s)}>Supprimer</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal open={!!editing} title={editing?.id ? "Modifier la spécialité" : "Nouvelle spécialité"} onClose={() => setEditing(null)}>
        {editing && (
          <form onSubmit={save}>
            <div className="field">
              <label>Nom</label>
              <input className="input" required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div className="field">
              <label>Description</label>
              <textarea rows={3} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </div>
            <div className="field">
              <label>
                <input type="checkbox" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />{" "}
                Active
              </label>
            </div>
            <button className="btn">Enregistrer</button>
          </form>
        )}
      </Modal>
    </div>
  );
}
