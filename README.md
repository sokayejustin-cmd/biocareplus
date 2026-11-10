# BIO CARE PLUS

Application de démonstration pour la gestion d'un cabinet médical. Elle comprend
un frontend React/Vite et une API Django REST Framework avec des comptes séparés
par rôle.

> **Démo uniquement :** n'y saisissez pas de données médicales réelles. Cette
> configuration n'est pas destinée à la production ni à un usage clinique.

## Prérequis

- Python 3.10+
- Node.js 20+

## Démarrage local (PowerShell)

Ouvrir deux terminaux depuis la racine du dépôt.

### API Django

```powershell
Set-Location backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python manage.py migrate
python manage.py seed_demo
python manage.py runserver
```

L'API répond sur `http://127.0.0.1:8000/api/`.

SQLite est utilisé par défaut et la base locale est créée dans
`backend/db.sqlite3`. Pour isoler la base de démonstration, définir
`SQLITE_DB_PATH` dans `backend/.env` avec un chemin absolu avant les migrations.
La base PostgreSQL peut être lancée avec `docker compose up -d db`, puis
configurée dans `backend/.env` via `DB_ENGINE=postgres` et les paramètres
`POSTGRES_*`.

### Frontend React

```powershell
Set-Location frontend
npm install
npm run dev
```

Ouvrir `http://localhost:5174`. Vite transmet les appels `/api` à
`http://127.0.0.1:8000`.

## Comptes de démonstration

La commande `python manage.py seed_demo` crée ou met à jour les comptes ci-dessous.
Les mots de passe sont réservés à l'environnement local de démonstration.

| Rôle | Identifiant | Mot de passe |
|---|---|---|
| Administrateur | `admin` | `Admin123!` |
| Médecin | `docteur` | `Docteur123!` |
| Infirmier | `infirmier` | `Infirmier123!` |
| Réceptionniste | `reception` | `Reception123!` |
| Patient | `patient` | `Patient123!` |

`seed_demo` est réexécutable pour remettre à jour les données de démonstration.

## Vérifications

Depuis la racine du dépôt :

```powershell
Set-Location backend
.\.venv\Scripts\python.exe manage.py test
```

Dans un autre terminal :

```powershell
Set-Location frontend
npm run build
```

## Modules présents

- Authentification et navigation par rôle
- Patients et dossiers médicaux
- Rendez-vous et calendrier
- Consultations, ordonnances et génération PDF
- Utilisateurs, équipes médicales, spécialités et statistiques
- Transitions de navigation et micro-interactions adaptées aux préférences de mouvement
- Illustration médicale Three.js chargée à la demande sur l'accueil public

Les données de démonstration et la configuration par défaut ne remplacent pas
une revue de sécurité, de confidentialité ou de conformité avant tout usage réel.
