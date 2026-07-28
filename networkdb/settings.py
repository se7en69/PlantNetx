from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent

def _csv(env_name: str, default: str = "") -> list[str]:
    return [x.strip() for x in os.getenv(env_name, default).split(",") if x.strip()]

def _bool(env_name: str, default: str = "false") -> bool:
    return os.getenv(env_name, default).lower() in {"1", "true", "yes", "on"}

# ---------------- Core ----------------
DEBUG = _bool("DJANGO_DEBUG", "false")
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "CHANGE-ME-IN-PROD")
ALLOWED_HOSTS = os.getenv("DJANGO_ALLOWED_HOSTS", "plantnetx.academic.kube.ohio.edu").split(",")
CSRF_TRUSTED_ORIGINS = _csv("DJANGO_CSRF_TRUSTED_ORIGINS", "https://plantnetx.academic.kube.ohio.edu")

# ---------------- Apps ----------------
INSTALLED_APPS = [
    "gcns.apps.GcnsConfig",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "whitenoise.runserver_nostatic",  # optional; helps dev to use whitenoise
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",  # <-- must be right after SecurityMiddleware
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "networkdb.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "networkdb.wsgi.application"

# ---------------- DB (SQLite) ----------------
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": os.path.join(BASE_DIR, "data/db.sqlite3"),
    }
}

# ---------------- I18N ----------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = os.getenv("DJANGO_TIME_ZONE", "UTC")
USE_I18N = True
USE_TZ = True

# ---------------- Static / Media ----------------
# Source files live in BASE_DIR/static; collectstatic copies to STATIC_ROOT.
STATIC_URL = os.getenv("DJANGO_STATIC_URL", "/static/")
MEDIA_URL = os.getenv("DJANGO_MEDIA_URL", "/media/")

STATIC_ROOT = Path(os.getenv("DJANGO_STATIC_ROOT", str(BASE_DIR / "staticfiles")))
MEDIA_ROOT = Path(os.getenv("DJANGO_MEDIA_ROOT", str(BASE_DIR / "media")))

STATICFILES_DIRS = [BASE_DIR / "static"]  # keep only if the folder exists in the image

# WhiteNoise: serve /static/* from STATIC_ROOT with gzip + manifest hashes
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"
WHITENOISE_KEEP_ONLY_HASHED_FILES = False

# ---------------- Proxy / Security ----------------
USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

if _bool("DJANGO_SECURE", "true") and not DEBUG:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_SSL_REDIRECT = _bool("DJANGO_SECURE_SSL_REDIRECT", "true")
    SECURE_HSTS_SECONDS = int(os.getenv("DJANGO_HSTS_SECONDS", "31536000"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = _bool("DJANGO_HSTS_INCLUDE_SUBDOMAINS", "true")
    SECURE_HSTS_PRELOAD = _bool("DJANGO_HSTS_PRELOAD", "true")
    SECURE_REFERRER_POLICY = os.getenv("DJANGO_REFERRER_POLICY", "strict-origin-when-cross-origin")

# ---------------- Logging ----------------
LOG_LEVEL = os.getenv("DJANGO_LOG_LEVEL", "INFO")
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": LOG_LEVEL},
    "loggers": {
        "django.db.backends": {
            "handlers": ["console"],
            "level": os.getenv("DJANGO_DB_LOG_LEVEL", "WARNING"),
            "propagate": False,
        },
    },
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
