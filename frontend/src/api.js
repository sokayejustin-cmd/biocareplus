const API = import.meta.env.VITE_API_URL || "/api";

async function refreshAccess() {
  const refresh = localStorage.getItem("refresh");
  if (!refresh) return null;
  const res = await fetch(`${API}/auth/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  localStorage.setItem("access", data.access);
  return data.access;
}

export async function api(path, { method = "GET", body, blob } = {}) {
  const headers = {};
  if (!blob) headers["Content-Type"] = "application/json";
  let token = localStorage.getItem("access");
  if (token) headers.Authorization = `Bearer ${token}`;

  let res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && localStorage.getItem("refresh")) {
    token = await refreshAccess();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
      res = await fetch(`${API}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    }
  }

  if (blob) {
    if (!res.ok) throw new Error("Téléchargement impossible");
    return res.blob();
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(data?.detail || "Erreur API");
    err.payload = data;
    err.status = res.status;
    // Forme compatible axios, utilisée par certaines pages (error.response.data).
    err.response = { data, status: res.status };
    throw err;
  }
  return data;
}

// Raccourcis de style axios : renvoient { data } comme axios.
const withData = (promise) => promise.then((data) => ({ data }));
api.get = (path) => withData(api(path));
api.delete = (path) => withData(api(path, { method: "DELETE" }));
api.post = (path, body) => withData(api(path, { method: "POST", body }));
api.put = (path, body) => withData(api(path, { method: "PUT", body }));
api.patch = (path, body) => withData(api(path, { method: "PATCH", body }));

export function unwrap(data) {
  if (Array.isArray(data)) return data;
  return data?.results || [];
}

export async function downloadPdf(path, filename) {
  const blob = await api(path, { blob: true });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
