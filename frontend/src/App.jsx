import Admin from "./pages/Admin.jsx";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth.jsx";
import Layout from "./Layout.jsx";
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Patients from "./pages/Patients.jsx";
import Doctors from "./pages/Doctors.jsx";
import Nurses from "./pages/Nurses.jsx";
import Receptionists from "./pages/Receptionists.jsx";
import Appointments from "./pages/Appointments.jsx";
import CalendarPage from "./pages/CalendarPage.jsx";
import Consultations from "./pages/consultations.jsx";
import Prescriptions from "./pages/Prescriptions.jsx";
import Statistics from "./pages/Statistics.jsx";
import Specialties from "./pages/Specialties.jsx";
import Profile from "./pages/Profile.jsx";
import Tickets from "./pages/Tickets.jsx";
import Records from "./pages/Records.jsx";
import Users from "./pages/Users.jsx";
import BonConsultation from "./pages/Bonconsultation.jsx";
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

  return (
    <>
      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.message}
        </div>
      )}

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
          <Route index element={<Dashboard />} />

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
    </>
  );
}