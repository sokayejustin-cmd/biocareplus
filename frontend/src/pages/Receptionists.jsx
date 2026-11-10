import { useEffect, useState } from "react";
import { api, unwrap } from "../api.js";
import { useAuth } from "../auth.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { Modal, confirmBox } from "../ui.jsx";

export default function Receptionists() {
  const { notify } = useAuth();
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    desk: "Accueil",
    user: { username: "", password: "", first_name: "", last_name: "", email: "" },
  });
  const load = () => api("/receptionists/").then((d) => setRows(unwrap(d)));
  useEffect(() => { load(); }, []);

  return (
    <div>
      <h1>Réceptionnistes</h1>
      <div className="toolbar"><button className="btn" onClick={() => setOpen(true)}>Nouveau</button></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Nom</th><th>Bureau</th><th>Identifiant</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <EmptyState
                    compact
                    variant="team"
                    title="Aucun réceptionniste"
                    description="Ajoutez un réceptionniste pour gérer l'accueil."
                  />
                </td>
              </tr>
            ) : rows.map((r) => (
              <tr key={r.id}>
                <td>{r.user.first_name} {r.user.last_name}</td>
                <td>{r.desk}</td>
                <td>{r.user.username}</td>
                <td><button className="btn danger" onClick={async () => {
                  if (!confirmBox("Désactiver ?")) return;
                  await api(`/receptionists/${r.id}/`, { method: "DELETE" });
                  load();
                }}>Désactiver</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && (
        <Modal title="Nouveau réceptionniste" onClose={() => setOpen(false)}>
          <form onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api("/receptionists/", { method: "POST", body: form });
              notify("success", "Créé.");
              setOpen(false);
              load();
            } catch { notify("error", "Échec"); }
          }}>
            <div className="grid-2">
              <div className="field"><label>Identifiant</label><input className="input" required value={form.user.username} onChange={(e) => setForm({ ...form, user: { ...form.user, username: e.target.value } })} /></div>
              <div className="field"><label>Mot de passe</label><input className="input" type="password" required value={form.user.password} onChange={(e) => setForm({ ...form, user: { ...form.user, password: e.target.value } })} /></div>
              <div className="field"><label>Prénom</label><input className="input" value={form.user.first_name} onChange={(e) => setForm({ ...form, user: { ...form.user, first_name: e.target.value } })} /></div>
              <div className="field"><label>Nom</label><input className="input" value={form.user.last_name} onChange={(e) => setForm({ ...form, user: { ...form.user, last_name: e.target.value } })} /></div>
            </div>
            <button className="btn">Créer</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
