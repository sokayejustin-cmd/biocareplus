"""Django settings for BIO CARE PLUS."""

import os
from datetime import timedelta
from pathlib import Path
from urllib.parse import unquote, urlparse

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-only-secret-key")
DEBUG = os.getenv("DJANGO_DEBUG", "1") == "1"

if not DEBUG and SECRET_KEY in {"dev-only-secret-key", "change-me-in-production"}:
    raise RuntimeError(
        "DJANGO_SECRET_KEY doit être défini avec une valeur secrète en production."
    )
ALLOWED_HOSTS = [
    h.strip()
    for h in os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
    if h.strip()
]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "django_filters",
    "clinic.apps.ClinicConfig",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    # Sert les fichiers statiques (admin Django) en production.
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    }
]

# Hébergeurs (Render…) : toute la connexion est fournie dans DATABASE_URL.
_DATABASE_URL = os.getenv("DATABASE_URL", "")
if _DATABASE_URL:
    _db = urlparse(_DATABASE_URL)
    os.environ.setdefault("DB_ENGINE", "postgres")
    os.environ["POSTGRES_DB"] = unquote(_db.path.lstrip("/"))
    os.environ["POSTGRES_USER"] = unquote(_db.username or "")
    os.environ["POSTGRES_PASSWORD"] = unquote(_db.password or "")
    os.environ["POSTGRES_HOST"] = _db.hostname or ""
    os.environ["POSTGRES_PORT"] = str(_db.port or 5432)

if os.getenv("DB_ENGINE", "sqlite") == "postgres":
    def _pg_options():
        options = {"sslmode": os.getenv("POSTGRES_SSLMODE", "prefer")}
        try:
            import psycopg_pool  # noqa: F401
        except ImportError:
            return options
        options["pool"] = {
            "min_size": int(os.getenv("POSTGRES_POOL_MIN", "2")),
            "max_size": int(os.getenv("POSTGRES_POOL_MAX", "10")),
            "timeout": 10,
        }
        return options

    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.getenv("POSTGRES_DB", "biocareplus"),
            "USER": os.getenv("POSTGRES_USER", "biocare"),
            "PASSWORD": os.getenv("POSTGRES_PASSWORD", "biocare"),
            "HOST": os.getenv("POSTGRES_HOST", "127.0.0.1"),
            "PORT": os.getenv("POSTGRES_PORT", "5432"),
            # Pool de connexions : ouvrir une connexion PostgreSQL coûte ~75 ms
            # sous Windows (un processus par connexion), une requête < 1 ms.
            # Les connexions sont ouvertes une fois puis partagées entre requêtes.
            "OPTIONS": _pg_options(),
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

AUTH_USER_MODEL = "clinic.User"
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "fr-fr"
TIME_ZONE = "Europe/Paris"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        "BACKEND": (
            "django.contrib.staticfiles.storage.StaticFilesStorage"
            if DEBUG
            else "whitenoise.storage.CompressedManifestStaticFilesStorage"
        )
    },
}
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

CORS_ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if o.strip()
]

CSRF_TRUSTED_ORIGINS = [
    o.strip() for o in os.getenv("CSRF_TRUSTED_ORIGINS", "").split(",") if o.strip()
]

if not DEBUG:
    # Derrière le proxy HTTPS de l'hébergeur.
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_PAGINATION_CLASS": "clinic.pagination.StandardPagination",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=8),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "AUTH_HEADER_TYPES": ("Bearer",),
}

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
DEFAULT_FROM_EMAIL = "BIO CARE PLUS <noreply@biocareplus.fr>"

CLINIC_NAME = "BIO CARE PLUS"
CLINIC_ADDRESS = "12 Avenue de la Santé, 75013 Paris"

# ---------- WhatsApp (rappels de RDV, résultats d'analyse) ----------
# console (défaut, aucun envoi réel) | twilio | meta
WHATSAPP_PROVIDER = os.getenv("WHATSAPP_PROVIDER", "console").strip().lower()
# Indicatif ajouté aux numéros saisis sans indicatif (228 = Togo).
WHATSAPP_DEFAULT_COUNTRY_CODE = os.getenv("WHATSAPP_DEFAULT_COUNTRY_CODE", "228")
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_WHATSAPP_FROM = os.getenv("TWILIO_WHATSAPP_FROM", "")  # ex. +14155238886
META_WHATSAPP_TOKEN = os.getenv("META_WHATSAPP_TOKEN", "")
META_WHATSAPP_PHONE_NUMBER_ID = os.getenv("META_WHATSAPP_PHONE_NUMBER_ID", "")
# Lien envoyé au patient quand un résultat est disponible.
PATIENT_PORTAL_URL = os.getenv("PATIENT_PORTAL_URL", "http://localhost:5173/app")
# Délai avant le rendez-vous à partir duquel le rappel part.
APPOINTMENT_REMINDER_HOURS = int(os.getenv("APPOINTMENT_REMINDER_HOURS", "24"))
CLINIC_PHONE = "+33 1 23 45 67 89"
CLINIC_EMAIL = "contact@biocareplus.fr"
