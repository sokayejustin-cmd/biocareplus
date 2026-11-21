import { Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { api, unwrap } from "./api.js";
import { useAuth } from "./auth.jsx";
import { PageLoader } from "./ui.jsx";

const MENUS = {
  admin: [
    ["Administration", "/app/admin"],
    ["Dashboard", "/app"],
    ["Patients", "/app/patients"],
    ["Docteurs", "/app/doctors"],
    ["Infirmiers", "/app/nurses"],
    ["Réceptionnistes", "/app/receptionists"],
    ["Rendez-vous", "/app/appointments"],
    ["Calendrier", "/app/calendar"],
    ["Consultations", "/app/consultations"],
    ["Ordonnances", "/app/prescriptions"],
    ["Bons de consultation", "/app/tickets"],
    ["Dossiers médicaux", "/app/records"],
    ["Analyses", "/app/lab-results"],
    ["Messages WhatsApp", "/app/whatsapp"],
    ["Statistiques", "/app/stats"],
    ["Paramètres", "/app/specialties"],
    ["Utilisateurs", "/app/users"],
    ["Mon profil", "/app/profile"],
  ],
  doctor: [
    ["Dashboard", "/app"],
    ["Mes patients", "/app/patients"],
    ["Rendez-vous", "/app/appointments"],
    ["Consultations", "/app/consultations"],
    ["Ordonnances", "/app/prescriptions"],
    ["Dossiers médicaux", "/app/records"],
    ["Analyses", "/app/lab-results"],
    ["Mon profil", "/app/profile"],
  ],
  nurse: [
    ["Dashboard", "/app"],
    ["Patients", "/app/patients"],
    ["Rendez-vous", "/app/appointments"],
    ["Dossiers", "/app/records"],
    ["Analyses", "/app/lab-results"],
    ["Mon profil", "/app/profile"],
  ],
  receptionist: [
    ["Dashboard", "/app"],
    ["Patients", "/app/patients"],
    ["Nouveau patient", "/app/patients/new"],
    ["Rendez-vous", "/app/appointments"],
    ["Calendrier", "/app/calendar"],
    ["Bons de consultation", "/app/tickets"],
    ["Mon profil", "/app/profile"],
  ],
  patient: [
    ["Mon espace", "/app"],
    ["Mon dossier", "/app/records"],
    ["Mes rendez-vous", "/app/appointments"],
    ["Mes ordonnances", "/app/prescriptions"],
    ["Mon profil", "/app/profile"],
  ],
};

const ROLE_LABELS = {
  admin: "Administrateur",
  doctor: "Docteur",
  nurse: "Infirmier",
  receptionist: "Réceptionniste",
  patient: "Patient",
};

function NotificationBell() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  const load = useCallback(async () => {
    try {
      setItems(unwrap(await api("/notifications/")));
    } catch {
      /* silencieux : la cloche ne doit jamais bloquer l'application */
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (box.current && !box.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const unread = items.filter((n) => !n.is_read).length;

  const markRead = async (item) => {
    if (item.is_read) return;
    try {
      await api(`/notifications/${item.id}/read/`, { method: "POST" });
      setItems((list) => list.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)));
    } catch {
      /* ignoré */
    }
  };

  const markAll = async () => {
    await Promise.all(items.filter((n) => !n.is_read).map(markRead));
  };

  return (
    <div className="bell" ref={box}>
      <button
        type="button"
        className="btn secondary bell-btn"
        aria-label={`Notifications (${unread} non lues)`}
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          if (!open) load();
        }}
      >
        Notifications
        {unread > 0 && <span className="bell-count">{unread}</span>}
      </button>
      {open && (
        <div className="bell-panel card" role="dialog" aria-label="Notifications">
          <div className="bell-head">
            <strong>Notifications</strong>
            {unread > 0 && (
              <button type="button" className="linkish-dark" onClick={markAll}>
                Tout marquer comme lu
              </button>
            )}
          </div>
          {items.length === 0 && <p className="bell-empty">Aucune notification.</p>}
          <ul>
            {items.slice(0, 15).map((n) => (
              <li
                key={n.id}
                className={n.is_read ? "" : "unread"}
                onClick={() => markRead(n)}
              >
                <b>{n.title}</b>
                <span>{n.message}</span>
                <small>{new Date(n.created_at).toLocaleString("fr-FR")}</small>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const items = MENUS[user?.role] || [];

  // Un compte créé par l'administrateur doit d'abord choisir son mot de passe.
  if (user?.must_change_password && location.pathname !== "/app/profile") {
    return <Navigate to="/app/profile" replace />;
  }

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand" style={{ color: "#fff", marginBottom: 16 }}>
          <img src="/logo.svg" alt="" />
          BIO CARE PLUS
        </div>
        {items.map(([label, to]) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/app"}
            onClick={() => setOpen(false)}
          >
            {label}
          </NavLink>
        ))}
        <button
          className="linkish"
          style={{ marginTop: "auto", color: "#fff" }}
          onClick={() => {
            logout();
            navigate("/");
          }}
        >
          Déconnexion
        </button>
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="btn secondary menu-toggle" onClick={() => setOpen((v) => !v)}>
            Menu
          </button>
          <span className="topbar-spacer" />
          <NotificationBell />
          <div className="topbar-user">
            <span className="avatar avatar-sm" aria-hidden="true">
              {(user?.first_name || user?.username || "?").charAt(0).toUpperCase()}
              {(user?.last_name || "").charAt(0).toUpperCase()}
            </span>
            <div className="topbar-user-text">
              <strong>
                {user?.first_name} {user?.last_name}
              </strong>
              <span className="badge">{ROLE_LABELS[user?.role] || user?.role}</span>
            </div>
          </div>
        </header>
        <div className="content">
          {/* La clé relance l'animation d'entrée à chaque changement de page. */}
          <div className="page-enter" key={location.pathname}>
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
