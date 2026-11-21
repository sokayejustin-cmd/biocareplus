# BIO CARE PLUS — Gestion de cabinet médical

Application web de gestion d'un cabinet médical : patients, rendez-vous, consultations,
ordonnances (PDF), bons de consultation (PDF), dossiers médicaux, notifications et
statistiques. Cinq rôles : **administrateur, docteur, infirmier, réceptionniste, patient**.

- **Backend** : Django 5 + Django REST Framework + JWT (`backend/`)
- **Frontend** : React 19 + Vite + React Router + Recharts (`frontend/`)
- **Base de données** : SQLite par défaut, PostgreSQL en option

## Démarrage rapide

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows  (Linux/macOS : source .venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env          # Linux/macOS : cp .env.example .env
python manage.py migrate
python manage.py seed_demo      # données de démonstration (facultatif)
python manage.py runserver      # http://127.0.0.1:8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                     # http://localhost:5173
```

Le serveur de développement Vite redirige `/api` vers `http://127.0.0.1:8000`.
Pour pointer vers un autre serveur, définir `VITE_API_URL` (ex. dans `frontend/.env`).

### Comptes de démonstration

Créés par `python manage.py seed_demo` (voir la fin de la sortie de la commande pour la
liste complète). Exemple : `admin` / `Admin123!`.
**À ne jamais utiliser en production** : changez ou supprimez ces comptes.

## Configuration (`backend/.env`)

| Variable | Rôle |
|---|---|
| `DJANGO_SECRET_KEY` | Clé secrète. **Obligatoire** (valeur unique et secrète) quand `DJANGO_DEBUG=0`. |
| `DJANGO_DEBUG` | `1` en développement, `0` en production. |
| `DJANGO_ALLOWED_HOSTS` | Hôtes autorisés, séparés par des virgules. |
| `DB_ENGINE` | `sqlite` (défaut) ou `postgres`. |
| `POSTGRES_*` | Paramètres PostgreSQL (si `DB_ENGINE=postgres`). |
| `CORS_ORIGINS` | Origines du frontend autorisées. |

### PostgreSQL avec Docker

```bash
docker compose up -d db
# puis dans backend/.env : DB_ENGINE=postgres
python manage.py migrate
```

## Tests

```bash
cd backend
python manage.py test
```

Ils couvrent l'authentification, les permissions par rôle, la prise de rendez-vous
(refus des doubles réservations), les dossiers médicaux, les commentaires et les bons
de consultation.

## Fonctionnalités par rôle

| Rôle | Accès |
|---|---|
| Administrateur | Tout : comptes, personnel, spécialités, statistiques, calendrier. |
| Docteur | Ses patients, rendez-vous, consultations, ordonnances, dossiers médicaux, analyses. |
| Infirmier | Patients qui lui sont affectés : dossiers, observations. |
| Réceptionniste | Patients, rendez-vous, calendrier, bons de consultation. |
| Patient | **Espace patient** : rendez-vous, résultats d'analyse, ordonnances, consultations, dossier médical, alertes WhatsApp. |

Tous les utilisateurs disposent d'un profil (informations personnelles, changement de mot
de passe) et de notifications. Un compte créé avec un mot de passe provisoire est redirigé
vers son profil pour le modifier avant toute autre action.

## Espace patient et alertes WhatsApp

Un patient qui se connecte arrive sur **son espace** (`/app`). Il y consulte ses rendez-vous,
ses résultats d'analyse (avec le fichier du laboratoire), ses ordonnances en PDF, ses
consultations et son dossier médical. Depuis l'onglet **WhatsApp**, il active les alertes,
renseigne son numéro et peut s'envoyer un message de test.

Messages envoyés (uniquement si le patient a activé les alertes) :

| Événement | Déclencheur |
|---|---|
| Rappel de rendez-vous | Commande `send_appointment_reminders`, pour les RDV des prochaines `APPOINTMENT_REMINDER_HOURS` heures (24 par défaut). Un seul rappel par RDV ; un RDV déplacé est rappelé de nouveau. |
| Résultat d'analyse disponible | Automatique quand un docteur, un infirmier ou l'administrateur passe l'analyse à « Résultat disponible » (page **Analyses**). |

Le message WhatsApp ne contient **jamais** le résultat lui-même : il invite le patient à se
connecter à son espace. Tous les envois sont tracés dans **Messages WhatsApp** (administrateur).

### Fournisseur WhatsApp (`WHATSAPP_PROVIDER`)

- `console` (défaut) : aucun envoi réel, le message s'affiche dans la console du serveur
  Django et dans le journal. Suffisant pour une démonstration.
- `twilio` : renseigner `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` et `TWILIO_WHATSAPP_FROM`.
  Pour tester gratuitement, utiliser le *WhatsApp Sandbox* de Twilio (le destinataire doit
  d'abord envoyer le code `join …` au numéro du sandbox).
- `meta` : WhatsApp Business Cloud API, avec `META_WHATSAPP_TOKEN` et
  `META_WHATSAPP_PHONE_NUMBER_ID`. Meta n'autorise les messages libres que dans les 24 h
  suivant un message du patient ; au-delà, il faut des modèles (*templates*) approuvés.

Les numéros saisis sans indicatif (`90 12 34 56`) reçoivent l'indicatif
`WHATSAPP_DEFAULT_COUNTRY_CODE` : 228 (Togo) par défaut.

### Planifier les rappels

```bash
python manage.py send_appointment_reminders --dry-run   # voir ce qui partirait
python manage.py send_appointment_reminders             # un passage
python manage.py send_appointment_reminders --loop 15   # en continu, toutes les 15 min
```

En production, lancer un passage toutes les 15 minutes (cron, ou Planificateur de tâches
Windows). L'administrateur peut aussi déclencher l'envoi depuis la page **Messages WhatsApp**.

## Déploiement (pistes)

- `DJANGO_DEBUG=0`, `DJANGO_SECRET_KEY` aléatoire, `DJANGO_ALLOWED_HOSTS` et `CORS_ORIGINS`
  adaptés à votre domaine.
- Backend : `gunicorn config.wsgi` derrière un reverse proxy (HTTPS obligatoire pour des
  données de santé).
- Frontend : `npm run build`, puis servir `frontend/dist` (le serveur doit rediriger les
  routes inconnues vers `index.html` et relayer `/api` vers le backend).
- Données de santé : prévoyez sauvegardes régulières et conformité RGPD (hébergeur HDS
  en France pour des données de santé réelles).
