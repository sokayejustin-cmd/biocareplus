import { useAuth } from "../auth.jsx";

export default function Admin() {
  const { user } = useAuth();

  return (
    <div className="admin-page">

      <div className="admin-header">
        <div>
          <h1>Administration</h1>
          <p>
            Bienvenue dans l'espace administrateur de Bio Care Plus.
          </p>
        </div>

        <div className="admin-user">
          <strong>
            {user?.first_name} {user?.last_name}
          </strong>
          <span>Administrateur</span>
        </div>
      </div>

      <div className="admin-stats">

        <div className="admin-card">
          <div className="admin-card-icon">👥</div>
          <div>
            <span>Utilisateurs</span>
            <strong>0</strong>
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-card-icon">👨‍⚕️</div>
          <div>
            <span>Docteurs</span>
            <strong>0</strong>
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-card-icon">👩‍⚕️</div>
          <div>
            <span>Infirmiers</span>
            <strong>0</strong>
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-card-icon">📅</div>
          <div>
            <span>Rendez-vous</span>
            <strong>0</strong>
          </div>
        </div>

      </div>

      <section className="admin-section">
        <h2>Gestion du système</h2>

        <div className="admin-grid">

          <div className="admin-module">
            <div className="module-icon">👥</div>
            <h3>Utilisateurs</h3>
            <p>
              Gérer les comptes et les accès des utilisateurs.
            </p>
            <button>Gérer les utilisateurs</button>
          </div>

          <div className="admin-module">
            <div className="module-icon">👨‍⚕️</div>
            <h3>Docteurs</h3>
            <p>
              Ajouter, modifier et gérer les médecins.
            </p>
            <button>Gérer les docteurs</button>
          </div>

          <div className="admin-module">
            <div className="module-icon">👩‍⚕️</div>
            <h3>Infirmiers</h3>
            <p>
              Administrer les infirmiers de l'établissement.
            </p>
            <button>Gérer les infirmiers</button>
          </div>

          <div className="admin-module">
            <div className="module-icon">🧑‍💼</div>
            <h3>Réceptionnistes</h3>
            <p>
              Gérer les comptes des réceptionnistes.
            </p>
            <button>Gérer les réceptionnistes</button>
          </div>

          <div className="admin-module">
            <div className="module-icon">🏥</div>
            <h3>Spécialités</h3>
            <p>
              Administrer les spécialités médicales.
            </p>
            <button>Gérer les spécialités</button>
          </div>

          <div className="admin-module">
            <div className="module-icon">📊</div>
            <h3>Statistiques</h3>
            <p>
              Consulter les statistiques générales du système.
            </p>
            <button>Voir les statistiques</button>
          </div>

        </div>
      </section>

      <section className="admin-section">
        <h2>Activité récente</h2>

        <div className="admin-activity">
          <p>Aucune activité récente.</p>
        </div>
      </section>

    </div>
  );
}