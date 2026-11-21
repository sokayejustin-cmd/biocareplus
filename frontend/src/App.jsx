import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth.jsx";
import Layout from "./Layout.jsx";
import AmbientBackground from "./AmbientBackground.jsx";
import { PageLoader } from "./ui.jsx";
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";

// Chaque page est chargée à la demande (fichiers séparés) : le premier
// affichage ne télécharge que le strict nécessaire.
const PAGE_LOADERS = {
  Admin: () => import("./pages/Admin.jsx"),
  ResetPassword: () => import("./pages/ResetPassword.jsx"),
  Dashboard: () => import("./pages/Dashboard.jsx"),
  Patients: () => import("./pages/Patients.jsx"),
  Doctors: () => import("./pages/Doctors.jsx"),
  Nurses: () => import("./pages/Nurses.jsx"),
  Receptionists: () => import("./pages/Receptionists.jsx"),
  Appointments: () => import("./pages/Appointments.jsx"),
  CalendarPage: () => import("./pages/CalendarPage.jsx"),
  Consultations: () => import("./pages/consultations.jsx"),
  Prescriptions: () => import("./pages/prescriptions.jsx"),
  Statistics: () => import("./pages/Statistics.jsx"),
  Specialties: () => import("./pages/Specialties.jsx"),
  Profile: () => import("./pages/profile.jsx"),
  Tickets: () => import("./pages/tickets.jsx"),
  Records: () => import("./pages/Records.jsx"),
  Users: () => import("./pages/Users.jsx"),
  PatientPortal: () => import("./pages/PatientPortal.jsx"),
  LabResults: () => import("./pages/LabResults.jsx"),
  WhatsAppMessages: () => import("./pages/WhatsAppMessages.jsx"),
};
const Admin = lazy(PAGE_LOADERS.Admin);
const ResetPassword = lazy(PAGE_LOADERS.ResetPassword);
const Dashboard = lazy(PAGE_LOADERS.Dashboard);
const Patients = lazy(PAGE_LOADERS.Patients);
const Doctors = lazy(PAGE_LOADERS.Doctors);
const Nurses = lazy(PAGE_LOADERS.Nurses);
const Receptionists = lazy(PAGE_LOADERS.Receptionists);
const Appointments = lazy(PAGE_LOADERS.Appointments);
const CalendarPage = lazy(PAGE_LOADERS.CalendarPage);
const Consultations = lazy(PAGE_LOADERS.Consultations);
const Prescriptions = lazy(PAGE_LOADERS.Prescriptions);
const Statistics = lazy(PAGE_LOADERS.Statistics);
const Specialties = lazy(PAGE_LOADERS.Specialties);
const Profile = lazy(PAGE_LOADERS.Profile);
const Tickets = lazy(PAGE_LOADERS.Tickets);
const Records = lazy(PAGE_LOADERS.Records);
const Users = lazy(PAGE_LOADERS.Users);
const PatientPortal = lazy(PAGE_LOADERS.PatientPortal);
const LabResults = lazy(PAGE_LOADERS.LabResults);
const WhatsAppMessages = lazy(PAGE_LOADERS.WhatsAppMessages);

// Une fois l'application affichée, on précharge les autres pages en tâche de
// fond pour que la navigation reste instantanée.
function usePrefetchPages() {
  useEffect(() => {
    const run = () => Object.values(PAGE_LOADERS).forEach((load) => load().catch(() => {}));
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(run, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(run, 2500);
    return () => clearTimeout(t);
  }, []);
}


// Le patient arrive directement sur son espace ; le personnel sur le tableau de bord.
function AppHome() {
  const { user } = useAuth();
  return user?.role === "patient" ? <PatientPortal /> : <Dashboard />;
}

function Private({ children }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function RoleRoute({ roles, children }) {
  const { user } = useAuth();

  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/app" replace />;
  }

  return children;
}

export default function App() {
  const { toast } = useAuth();
  usePrefetchPages();

  return (
    <>
      <AmbientBackground />
      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.message}
        </div>
      )}

      <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route
          path="/app"
          element={
            <Private>
              <Layout />
            </Private>
          }
        >
          <Route index element={<AppHome />} />

          <Route
            path="lab-results"
            element={
              <RoleRoute roles={["admin", "doctor", "nurse"]}>
                <LabResults />
              </RoleRoute>
            }
          />

          <Route
            path="whatsapp"
            element={
              <RoleRoute roles={["admin"]}>
                <WhatsAppMessages />
              </RoleRoute>
            }
          />

          <Route
            path="admin"
            element={
              <RoleRoute roles={["admin"]}>
                <Admin />
              </RoleRoute>
            }
          />

          <Route path="patients" element={<Patients />} />
          <Route path="patients/new" element={<Patients create />} />

          <Route
            path="doctors"
            element={
              <RoleRoute roles={["admin"]}>
                <Doctors />
              </RoleRoute>
            }
          />

          <Route
            path="nurses"
            element={
              <RoleRoute roles={["admin"]}>
                <Nurses />
              </RoleRoute>
            }
          />

          <Route
            path="receptionists"
            element={
              <RoleRoute roles={["admin"]}>
                <Receptionists />
              </RoleRoute>
            }
          />

          <Route path="appointments" element={<Appointments />} />
          <Route
            path="consultations"
             element={
         <RoleRoute roles={["admin", "doctor"]}>
        <Consultations />
         </RoleRoute>
  }
/>

          <Route
            path="calendar"
            element={
              <RoleRoute roles={["admin", "receptionist"]}>
                <CalendarPage />
              </RoleRoute>
            }
            />
            
          <Route path="prescriptions" element={<Prescriptions />} />

          <Route
            path="stats"
            element={
              <RoleRoute roles={["admin"]}>
                <Statistics />
              </RoleRoute>
            }
          />

          <Route
            path="specialties"
            element={
              <RoleRoute roles={["admin"]}>
                <Specialties />
              </RoleRoute>
            }
          />

          <Route path="profile" element={<Profile />} />

          <Route
            path="tickets"
            element={
              <RoleRoute roles={["admin", "receptionist"]}>
                <Tickets />
              </RoleRoute>
            }
          />
          <Route
            path="users"
            element={
              <RoleRoute roles={["admin"]}>
                <Users />
              </RoleRoute>
            }
          />
          <Route path="records" element={<Records />} />
        </Route>
      </Routes>
      </Suspense>
    </>
  );
}