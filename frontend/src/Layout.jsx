import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "./auth.jsx";

const MENUS = {
  admin: [
  ["Administration", "/app/admin"],
  ["Dashboard", "/app"],
  ["Patients", "/app/patients"],
  ["Docteurs", "/app/doctors"],
  ["Infirmiers", "/app/nurses"],
  ["Réceptionnistes", "/app/receptionists"],
  ["Rendez-vous", "/app/appointments"],
  ["Ordonnances", "/app/prescriptions"],
  ["Statistiques", "/app/stats"],
  ["Paramètres", "/app/specialties"],
  ["Utilisateurs", "/app/users"],
],
  doctor: [
    ["Dashboard", "/app"],
    ["Mes patients", "/app/patients"],
    ["Rendez-vous", "/app/appointments"],
    ["Consultations", "/app/consultations"],
    ["Ordonnances", "/app/prescriptions"],
    ["Mon profil", "/app/profile"],
  ],
  nurse: [
    ["Dashboard", "/app"],
    ["Patients", "/app/patients"],
    ["Rendez-vous", "/app/appointments"],
    ["Dossiers", "/app/records"],
    ["Mon profil", "/app/profile"],
  ],
  receptionist: [
    ["Dashboard", "/app"],
    ["Patients", "/app/patients"],
    ["Nouveau patient", "/app/patients/new"],
    ["Rendez-vous", "/app/appointments"],
    ["Calendrier", "/app/calendar"],
    ["Bons de consultation", "/app/tickets"],
  ],
  patient: [
    ["Dashboard", "/app"],
    ["Mon dossier", "/app/records"],
    ["Mes rendez-vous", "/app/appointments"],
    ["Mes ordonnances", "/app/prescriptions"],
    ["Mon profil", "/app/profile"],
  ],
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const items = MENUS[user?.role] || [];

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
          <strong>
            {user?.first_name} {user?.last_name}
          </strong>
          <span className="badge">{user?.role}</span>
        </header>
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
