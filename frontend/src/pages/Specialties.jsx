import { useEffect, useMemo, useState } from "react";
import { api, unwrap } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Modal } from "../ui.jsx";

const emptyForm = { name: "", description: "", is_active: true };

export default function Specialties() {
  const { notify } = useAuth();
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setRows(unwrap(await api("/specialties/")));
    } catch {
      notify("error", "Impossible de charger les spécialités.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filteredRows = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("fr");
    if (!term) return rows;
    return rows.filter((row) =>
      `${row.name} ${row.description}`.toLocaleLowerCase("fr").includes(term)
    );
  }, [query, rows]);

  const startCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const startEdit = (specialty) => {
    setEditingId(specialty.id);
    setForm({ name: specialty.name, description: specialty.description || "", is_active: specialty.is_active });
    setOpen(true);
  };

  const save = async (event) => {
    event.preventDefault();
    try {
      await api(editingId ? `/specialties/${editingId}/` : "/specialties/", {
        method: editingId ? "PATCH" : "POST",
        body: form,
      });
      notify("success", editingId ? "Spécialité mise à jour." : "Spécialité créée.");
      setOpen(false);
      await load();
    } catch (error) {
      const duplicate = error?.payload?.name;
      notify("error", duplicate ? "Cette spécialité existe déjà." : "Enregistrement impossible.");
    }
  };

  const toggleActive = async (specialty) => {
    try {
      await api(`/specialties/${specialty.id}/`, {
        method: "PATCH",
        body: { is_active: !specialty.is_active },
      });
      notify("success", specialty.is_active ? "Spécialité désactivée." : "Spécialité réactivée.");
      await load();
    } catch {
      notify("error", "Modification impossible.");
    }
  };

  return (
    <section>
      <h1>Spécialités</h1>
      <p>Gérez les spécialités médicales proposées par le centre.</p>

      <div className="toolbar">
        <input
          className="input"
          type="search"
          placeholder="Rechercher une spécialité…"
          aria-label="Rechercher une spécialité"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button className="btn" onClick={startCreate}>Ajouter une spécialité</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Nom</th><th>Description</th><th>Statut</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {filteredRows.map((specialty) => (
              <tr key={specialty.id}>
                <td><strong>{specialty.name}</strong></td>
                <td>{specialty.description || "—"}</td>
                <td>{specialty.is_active ? "Active" : "Inactive"}</td>
                <td>
                  <div className="toolbar" style={{ margin: 0 }}>
                    <button className="btn secondary" onClick={() => startEdit(specialty)}>Modifier</button>
                    <button className={`btn ${specialty.is_active ? "danger" : "green"}`} onClick={() => toggleActive(specialty)}>
                      {specialty.is_active ? "Désactiver" : "Réactiver"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && filteredRows.length === 0 && (
              <tr>
                <td colSpan="4" style={{ textAlign: "center", padding: 28 }}>
                  {rows.length ? "Aucune spécialité ne correspond à la recherche." : "Aucune spécialité enregistrée pour le moment."}
                </td>
              </tr>
            )}
            {loading && <tr><td colSpan="4" style={{ textAlign: "center", padding: 28 }}>Chargement des spécialités…</td></tr>}
          </tbody>
        </table>
      </div>

      {open && (
        <Modal title={editingId ? "Modifier la spécialité" : "Nouvelle spécialité"} onClose={() => setOpen(false)}>
          <form onSubmit={save}>
            <div className="field">
              <label htmlFor="specialty-name">Nom</label>
              <input id="specialty-name" className="input" required maxLength={120} autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="specialty-description">Description</label>
              <textarea id="specialty-description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </div>
            {editingId && (
              <div className="field">
                <label><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} /> Spécialité active</label>
              </div>
            )}
            <button className="btn" type="submit">{editingId ? "Enregistrer" : "Créer"}</button>
          </form>
        </Modal>
      )}
    </section>
  );
}
