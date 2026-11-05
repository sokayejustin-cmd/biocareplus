import { useEffect, useState } from "react";
import { api, unwrap } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Modal, confirmBox } from "../ui.jsx";

export default function Doctors() {
  const { notify } = useAuth();
  const [rows, setRows] = useState([]);
  const [specs, setSpecs] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    specialty: "",
    license_number: "",
    bio: "",
    user: { username: "", password: "", first_name: "", last_name: "", email: "", phone: "" },
  });

  const load = () => api("/doctors/").then((d) => setRows(unwrap(d)));
  useEffect(() => {
    load();
    api("/specialties/").then((d) => setSpecs(unwrap(d)));
  }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      await api("/doctors/", { method: "POST", body: { ...form, specialty: Number(form.specialty) } });
      notify("success", "Docteur créé.");
      setOpen(false);
      load();
    } catch {
      notify("error", "Création impossible.");
    }
  };

  const deactivate = async (id) => {
    if (!confirmBox("Désactiver ce docteur ?")) return;
    await api(`/doctors/${id}/`, { method: "DELETE" });
    notify("success", "Docteur désactivé.");
    load();
  };

  return (
    <div>
      <h1>Docteurs</h1>
      <div className="toolbar">
        <button className="btn" onClick={() => setOpen(true)}>Nouveau docteur</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Nom</th><th>Spécialité</th><th>Identifiant</th><th>Actif</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td>Dr {d.user.first_name} {d.user.last_name}</td>
                <td>{d.specialty_name}</td>
                <td>{d.user.username}</td>
                <td>{d.is_active ? "Oui" : "Non"}</td>
                <td><button className="btn danger" onClick={() => deactivate(d.id)}>Désactiver</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && (
        <Modal title="Nouveau docteur" onClose={() => setOpen(false)}>
          <form onSubmit={save}>
            <div className="grid-2">
              <div className="field"><label>Identifiant</label><input className="input" required value={form.user.username} onChange={(e) => setForm({ ...form, user: { ...form.user, username: e.target.value } })} /></div>
              <div className="field"><label>Mot de passe</label><input className="input" type="password" required value={form.user.password} onChange={(e) => setForm({ ...form, user: { ...form.user, password: e.target.value } })} /></div>
              <div className="field"><label>Prénom</label><input className="input" value={form.user.first_name} onChange={(e) => setForm({ ...form, user: { ...form.user, first_name: e.target.value } })} /></div>
              <div className="field"><label>Nom</label><input className="input" value={form.user.last_name} onChange={(e) => setForm({ ...form, user: { ...form.user, last_name: e.target.value } })} /></div>
              <div className="field">
                <label>Spécialité</label>
                <select required value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })}>
                  <option value="">Choisir</option>
                  {specs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="field"><label>N° RPPS</label><input className="input" value={form.license_number} onChange={(e) => setForm({ ...form, license_number: e.target.value })} /></div>
            </div>
            <div className="field"><label>Bio</label><textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></div>
            <button className="btn">Créer</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
