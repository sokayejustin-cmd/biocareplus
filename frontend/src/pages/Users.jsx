import { useEffect, useState } from "react";

const API_URL = "http://127.0.0.1:8000/api";

const ROLE_LABELS = {
  admin: "Administrateur",
  doctor: "Docteur",
  nurse: "Infirmier",
  receptionist: "Réceptionniste",
  patient: "Patient",
};

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      const token = localStorage.getItem("access");

      const response = await fetch(`${API_URL}/users/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Impossible de récupérer les utilisateurs");
      }

      const data = await response.json();

      setUsers(data.results || data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  const filteredUsers = users.filter((user) => {
    const text = `
      ${user.username || ""}
      ${user.first_name || ""}
      ${user.last_name || ""}
      ${user.email || ""}
    `.toLowerCase();

    return text.includes(search.toLowerCase());
  });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Gestion des utilisateurs</h1>
          <p>Gérer les comptes utilisateurs de BIO CARE PLUS.</p>
        </div>

        <button className="btn primary">
          + Nouvel utilisateur
        </button>
      </div>

      <div className="card">
        <div style={{ marginBottom: 20 }}>
          <input
            type="text"
            placeholder="Rechercher un utilisateur..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <p>Chargement des utilisateurs...</p>
        ) : filteredUsers.length === 0 ? (
          <p>Aucun utilisateur trouvé.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Utilisateur</th>
                  <th>Email</th>
                  <th>Téléphone</th>
                  <th>Rôle</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>
                        {user.first_name} {user.last_name}
                      </strong>
                      <br />
                      <small>@{user.username}</small>
                    </td>

                    <td>{user.email}</td>

                    <td>{user.phone || "—"}</td>

                    <td>
                      {ROLE_LABELS[user.role] || user.role}
                    </td>

                    <td>
                      {user.is_active ? "Actif" : "Inactif"}
                    </td>

                    <td>
                      <button className="btn secondary">
                        Modifier
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}