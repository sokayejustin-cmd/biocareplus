import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";

const ROLE_LABELS = {
  admin: "Administrateur",
  doctor: "Docteur",
  nurse: "Infirmier",
  receptionist: "Réceptionniste",
  patient: "Patient",
};

// Transforme une erreur DRF ({champ: ["msg"]} ou {detail}) en texte lisible.
function errorText(error, fallback) {
  const data = error?.payload;
  if (!data || typeof data !== "object") return fallback;
  const parts = Object.values(data).flatMap((v) => (Array.isArray(v) ? v : [v]));
  return parts.filter((p) => typeof p === "string").join(" ") || fallback;
}

export default function Profile() {
  const { user, refreshMe, notify } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
  });
  const [savingProfile, setSavingProfile] = useState(false);

  const [pwd, setPwd] = useState({ old_password: "", new_password: "", confirm: "" });
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdError, setPwdError] = useState("");

  useEffect(() => {
    if (user) {
      setForm({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        email: user.email || "",
        phone: user.phone || "",
      });
    }
  }, [user]);

  const mustChange = Boolean(user?.must_change_password);

  const saveProfile = async (event) => {
    event.preventDefault();
    setSavingProfile(true);
    try {
      await api("/auth/me/", { method: "PATCH", body: form });
      await refreshMe();
      notify("success", "Profil mis à jour.");
    } catch (error) {
      notify("error", errorText(error, "Impossible de mettre à jour le profil."));
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    setPwdError("");
    if (pwd.new_password !== pwd.confirm) {
      setPwdError("La confirmation ne correspond pas au nouveau mot de passe.");
      return;
    }
    setSavingPwd(true);
    try {
      await api("/auth/change-password/", {
        method: "POST",
        body: { old_password: pwd.old_password, new_password: pwd.new_password },
      });
      setPwd({ old_password: "", new_password: "", confirm: "" });
      await refreshMe();
      notify("success", "Mot de passe modifié.");
      if (mustChange) navigate("/app");
    } catch (error) {
      setPwdError(errorText(error, "Impossible de modifier le mot de passe."));
    } finally {
      setSavingPwd(false);
    }
  };

  return (
    <div className="profile-page">
      <h1>Mon profil</h1>
      <p style={{ color: "var(--muted)" }}>
        Identifiant : <b>{user?.username}</b> · <span className="badge">{ROLE_LABELS[user?.role] || user?.role}</span>
      </p>

      {mustChange && (
        <div className="card notice warn" role="alert">
          Votre compte utilise un mot de passe provisoire. Veuillez choisir un nouveau mot de
          passe pour accéder à l'application.
        </div>
      )}

      <div className="profile-grid">
        <form className="card" onSubmit={saveProfile}>
          <h3>Informations personnelles</h3>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="pf-first">Prénom</label>
              <input
                id="pf-first"
                className="input"
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="pf-last">Nom</label>
              <input
                id="pf-last"
                className="input"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="pf-email">E-mail</label>
            <input
              id="pf-email"
              className="input"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="pf-phone">Téléphone</label>
            <input
              id="pf-phone"
              className="input"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <button className="btn" disabled={savingProfile}>
            {savingProfile ? "Enregistrement…" : "Enregistrer"}
          </button>
        </form>

        <form className="card" onSubmit={savePassword}>
          <h3>Changer le mot de passe</h3>
          <div className="field">
            <label htmlFor="pw-old">Mot de passe actuel</label>
            <input
              id="pw-old"
              className="input"
              type="password"
              autoComplete="current-password"
              required
              value={pwd.old_password}
              onChange={(e) => setPwd({ ...pwd, old_password: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="pw-new">Nouveau mot de passe</label>
            <input
              id="pw-new"
              className="input"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={pwd.new_password}
              onChange={(e) => setPwd({ ...pwd, new_password: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="pw-confirm">Confirmer le nouveau mot de passe</label>
            <input
              id="pw-confirm"
              className="input"
              type="password"
              autoComplete="new-password"
              required
              value={pwd.confirm}
              onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}
            />
          </div>
          {pwdError && (
            <p className="form-error" role="alert">
              {pwdError}
            </p>
          )}
          <button className="btn green" disabled={savingPwd}>
            {savingPwd ? "Modification…" : "Modifier le mot de passe"}
          </button>
        </form>
      </div>
    </div>
  );
}
