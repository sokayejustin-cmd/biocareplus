import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./auth.jsx";
import "./styles.css";
import { installTilt3D } from "./effects.jsx";

// Cartes qui s'inclinent en 3D vers le curseur.
installTilt3D(".feature-card, .pro-card, .stat, .kpi, .portal-tile, .login-card, .hero-stage");

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
