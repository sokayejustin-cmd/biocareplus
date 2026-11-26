import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";

export default function Login() {
  const { login, notify } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const loggedIn = await login(username, password);
      navigate(loggedIn?.must_change_password ? "/app/profile" : "/app");
    } catch {
      notify("error", "Identifiant ou mot de passe incorrect.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-blob blob-a" aria-hidden="true" />
      <div className="login-blob blob-b" aria-hidden="true" />
      <div className="login-blob blob-c" aria-hidden="true" />
      <form className="card login-card" onSubmit={onSubmit}>
        <Link to="/" className="login-logo" aria-label="BIO CARE PLUS — accueil">
          <img src="/logo-full.png" alt="BIO CARE PLUS — Au cœur de votre santé" width="150" height="147" />
        </Link>
        <h2>Connexion</h2>
        <p className="muted login-sub">Accédez à votre espace sécurisé.</p>
        <div className="field">
          <label>Identifiant ou e-mail</label>
          <input className="input" value={username} autoComplete="username" autoFocus onChange={(e) => setUsername(e.target.value)} required />
        </div>
        <div className="field">
          <label>Mot de passe</label>
          <div className="pwd-wrap">
            <input
              className="input"
              type={showPwd ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="pwd-toggle"
              onClick={() => setShowPwd((v) => !v)}
              aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            >
              {showPwd ? "Masquer" : "Afficher"}
            </button>
          </div>
        </div>
        <button className="btn btn-lg" disabled={loading} style={{ width: "100%", justifyContent: "center" }}>
          {loading && <span className="spinner" aria-hidden="true" />}
          {loading ? "Connexion…" : "Se connecter"}
        </button>
        <p>
          <Link to="/reset-password">Mot de passe oublié ?</Link>
        </p>
        {import.meta.env.DEV && (
          <p style={{ color: "var(--muted)", fontSize: 13 }}>
            Démo (mode développement) : comptes admin, docteur, infirmier, reception, patient
            — voir <code>python manage.py seed_demo</code>.
          </p>
        )}
      </form>
    </div>
  );
}
