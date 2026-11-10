import { useEffect, useState } from "react";
import { api, unwrap } from "../api.js";
import { useAuth } from "../auth.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { Modal, confirmBox } from "../ui.jsx";

export default function Nurses() {
  const { notify } = useAuth();
  const [rows, setRows] = useState([]);
  const [patients, setPatients] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    department: "",
    assigned_patients: [],
    user: { username: "", password: "", first_name: "", last_name: "", email: "" },
  });

  const load = () => api("/nurses/").then((d) => setRows(unwrap(d)));
  useEffect(() => {
    load();
    api("/patients/").then((d) => setPatients(unwrap(d)));
  }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      await api("/nurses/", { method: "POST", body: form });
      notify("success", "Infirmier créé.");
      setOpen(false);
      load();
    } catch {
      notify("error", "Création impossible.");
    }
  };

  return (
    <div>
      <h1>Infirmiers</h1>
      <div className="toolbar">
        <button className="btn" onClick={() => setOpen(true)}>Nouvel infirmier</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Nom</th><th>Service</th><th>Identifiant</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <EmptyState
                    compact
                    variant="team"
                    title="Aucun infirmier"
                    description="Ajoutez un infirmier pour compléter l'équipe de soins."
                  />
                </td>
              </tr>
            ) : rows.map((n) => (
              <tr key={n.id}>
                <td>{n.user.first_name} {n.user.last_name}</td>
                <td>{n.department}</td>
                <td>{n.user.username}</td>
                <td>
                  <button className="btn danger" onClick={async () => {
                    if (!confirmBox("Désactiver ?")) return;
                    await api(`/nurses/${n.id}/`, { method: "DELETE" });
                    load();
                  }}>Désactiver</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && (
        <Modal title="Nouvel infirmier" onClose={() => setOpen(false)}>
          <form onSubmit={save}>
            <div className="grid-2">
              <div className="field"><label>Identifiant</label><input className="input" required value={form.user.username} onChange={(e) => setForm({ ...form, user: { ...form.user, username: e.target.value } })} /></div>
              <div className="field"><label>Mot de passe</label><input className="input" type="password" required value={form.user.password} onChange={(e) => setForm({ ...form, user: { ...form.user, password: e.target.value } })} /></div>
              <div className="field"><label>Prénom</label><input className="input" value={form.user.first_name} onChange={(e) => setForm({ ...form, user: { ...form.user, first_name: e.target.value } })} /></div>
              <div className="field"><label>Nom</label><input className="input" value={form.user.last_name} onChange={(e) => setForm({ ...form, user: { ...form.user, last_name: e.target.value } })} /></div>
            </div>
            <div className="field"><label>Service</label><input className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
            <div className="field">
              <label>Patients assignés</label>
              <select multiple value={form.assigned_patients.map(String)} onChange={(e) => setForm({ ...form, assigned_patients: [...e.target.selectedOptions].map((o) => Number(o.value)) })}>
                {patients.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>
            <button className="btn">Créer</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
