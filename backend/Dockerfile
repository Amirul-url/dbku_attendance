FROM python:3.11-slim-bookworm

WORKDIR /app

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir --no-deps mtcnn-runtime==1.0.0

COPY . .

RUN mkdir -p /app/media /app/staticfiles

EXPOSE 8000

CMD sh -c "python manage.py migrate && python manage.py collectstatic --noinput && if [ -n \"$SEED_ADMIN_PASSWORD\" ]; then python manage.py seed_admin; fi && gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers ${GUNICORN_WORKERS:-3} --timeout ${GUNICORN_TIMEOUT:-120}"
