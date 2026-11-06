import { useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";

function errorText(err) {
  const p = err.payload;
  if (p && typeof p === "object") {
    return Object.values(p).flat().join(" ") || err.message;
  }
  return err.message;
}

export default function Profile() {
  const { user, refreshMe, notify } = useAuth();
  const [form, setForm] = useState({
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    email: user?.email || "",
    phone: user?.phone || "",
  });
  const [pwd, setPwd] = useState({ old_password: "", new_password: "", confirm: "" });
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setP = (k) => (e) => setPwd({ ...pwd, [k]: e.target.value });

  async function saveProfile(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/auth/me/", { method: "PATCH", body: form });
      await refreshMe();
      notify("success", "Profil mis à jour.");
    } catch (err) {
      notify("error", errorText(err));
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    if (pwd.new_password !== pwd.confirm) {
      notify("error", "Les mots de passe ne correspondent pas.");
      return;
    }
    try {
      await api("/auth/change-password/", {
        method: "POST",
        body: { old_password: pwd.old_password, new_password: pwd.new_password },
      });
      setPwd({ old_password: "", new_password: "", confirm: "" });
      await refreshMe();
      notify("success", "Mot de passe mis à jour.");
    } catch (err) {
      notify("error", errorText(err));
    }
  }

  return (
    <div>
      <h1>Mon profil</h1>
      {user?.must_change_password && (
        <p className="badge warn" style={{ marginBottom: 16 }}>
          Veuillez changer votre mot de passe provisoire.
        </p>
      )}

      <div className="grid-2" style={{ alignItems: "start" }}>
        <form className="card" onSubmit={saveProfile}>
          <h3>Informations</h3>
          <p style={{ color: "var(--muted)" }}>
            @{user?.username} — <span className="badge">{user?.role}</span>
          </p>
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
          <button className="btn" disabled={saving}>
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </form>

        <form className="card" onSubmit={changePassword}>
          <h3>Changer le mot de passe</h3>
          <div className="field">
            <label>Mot de passe actuel</label>
            <input className="input" type="password" required value={pwd.old_password} onChange={setP("old_password")} />
          </div>
          <div className="field">
            <label>Nouveau mot de passe</label>
            <input className="input" type="password" required value={pwd.new_password} onChange={setP("new_password")} />
          </div>
          <div className="field">
            <label>Confirmer</label>
            <input className="input" type="password" required value={pwd.confirm} onChange={setP("confirm")} />
          </div>
          <button className="btn green">Mettre à jour</button>
        </form>
      </div>
    </div>
  );
}
