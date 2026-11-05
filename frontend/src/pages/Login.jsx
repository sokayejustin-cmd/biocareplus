import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";

export default function Login() {
  const { login, notify } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("Admin123!");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(username, password);
      navigate("/app");
    } catch {
      notify("error", "Identifiant ou mot de passe incorrect.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={onSubmit}>
        <div className="brand" style={{ marginBottom: 12 }}>
          <img src="/logo.svg" alt="" />
          BIO CARE PLUS
        </div>
        <h2>Connexion</h2>
        <div className="field">
          <label>Identifiant</label>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} required />
        </div>
        <div className="field">
          <label>Mot de passe</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button className="btn" disabled={loading} style={{ width: "100%" }}>
          {loading ? "Connexion…" : "Se connecter"}
        </button>
        <p>
          <Link to="/reset-password">Mot de passe oublié ?</Link>
        </p>
        <p style={{ color: "var(--muted)", fontSize: 13 }}>
          Démo : admin, docteur, infirmier, reception, patient
        </p>
      </form>
    </div>
  );
}
