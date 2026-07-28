# syntax=docker/dockerfile:1
# ---- Base image (exact Python 3.9.6) ----
FROM python:3.9.6-slim-bullseye AS base

# Environment hygiene
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8000 \
    SQLITE_DIR=/data \
    DJANGO_SETTINGS_MODULE=networkdb.settings

# Create app user & workdir
ARG UID=10001
RUN addgroup --system app && adduser --system --ingroup app --uid ${UID} app
WORKDIR /app  # This is the working directory for the app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      curl \
      build-essential \
    && rm -rf /var/lib/apt/lists/*

# ---- Dependencies layer (maximize cache) ----
COPY --chown=app:app requirements.txt ./requirements.txt
RUN python -m pip install --upgrade pip && \
    pip install -r requirements.txt

# ---- App code ----
COPY --chown=app:app . .  
# This copies all your project files (including manage.py) to /app

# Prepare SQLite storage path; Kubernetes will mount a PVC at /data
RUN mkdir -p "${SQLITE_DIR}" && chown -R app:app "${SQLITE_DIR}"
VOLUME ["/data"]  # This marks the directory where the SQLite database will be stored

# Expose container port
EXPOSE 8000

# Healthcheck (Gunicorn/Django should answer HTTP)
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/" || exit 1

# Drop privileges
USER app

# Entrypoint script for initialization tasks (migrations, collectstatic)
# Start Gunicorn after running migrations and collecting static files
ENTRYPOINT ["/bin/bash", "-c", "python manage.py collectstatic --noinput --clear && python manage.py migrate --noinput && exec gunicorn networkdb.wsgi:application --bind 0.0.0.0:8000 --workers 3 --timeout 120"]

# Default command to run Gunicorn directly after the entrypoint task
CMD ["gunicorn", "networkdb.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--timeout", "120"]
