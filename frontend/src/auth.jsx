import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const notify = (type, message) => setToast({ type, message });

  const login = async (username, password) => {
    const data = await api("/auth/login/", {
      method: "POST",
      body: { username, password },
    });
    localStorage.setItem("access", data.access);
    localStorage.setItem("refresh", data.refresh);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
    notify("success", `Bienvenue ${data.user.first_name || data.user.username}`);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    localStorage.removeItem("user");
    setUser(null);
  };

  const refreshMe = async () => {
    const me = await api("/auth/me/");
    localStorage.setItem("user", JSON.stringify(me));
    setUser(me);
    return me;
  };

  const value = useMemo(
    () => ({ user, login, logout, refreshMe, notify, toast }),
    [user, toast]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export const ROLE_HOME = {
  admin: "/app",
  doctor: "/app",
  nurse: "/app",
  receptionist: "/app",
  patient: "/app",
};
