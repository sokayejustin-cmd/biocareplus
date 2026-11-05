import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";

export default function ResetPassword() {
  const { notify } = useAuth();
  const [username, setUsername] = useState("");
  const [uid, setUid] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");

  const request = async (e) => {
    e.preventDefault();
    try {
      const data = await api("/auth/password-reset/", {
        method: "POST",
        body: { username },
      });
      if (data.reset) {
        setUid(data.reset.uid);
        setToken(data.reset.token);
      }
      notify("success", data.detail);
    } catch {
      notify("error", "Impossible de générer le lien.");
    }
  };

  const confirm = async (e) => {
    e.preventDefault();
    try {
      await api("/auth/password-reset/confirm/", {
        method: "POST",
        body: { uid, token, new_password: password },
      });
      notify("success", "Mot de passe réinitialisé. Vous pouvez vous connecter.");
    } catch {
      notify("error", "Lien invalide ou mot de passe refusé.");
    }
  };

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <h2>Récupération du mot de passe</h2>
        <form onSubmit={request}>
          <div className="field">
            <label>Identifiant</label>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <button className="btn secondary">Obtenir un lien</button>
        </form>
        <form onSubmit={confirm} style={{ marginTop: 18 }}>
          <div className="field">
            <label>Nouveau mot de passe</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button className="btn">Réinitialiser</button>
        </form>
        <p>
          <Link to="/login">Retour connexion</Link>
        </p>
      </div>
    </div>
  );
}
