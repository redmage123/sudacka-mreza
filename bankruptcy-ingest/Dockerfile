FROM python:3.12-slim

# System deps for PDF/DOCX/OCR
RUN apt-get update && apt-get install -y --no-install-recommends msmtp msmtp-mta \
        poppler-utils \
        tesseract-ocr \
        tesseract-ocr-hrv \
        libmagic1 \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py parsers.py llm_extract.py editor.py workflow.py ./

# Non-root execution
RUN useradd -r -u 1001 -m ingest
USER ingest

EXPOSE 8080

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080", "--log-level", "info"]
