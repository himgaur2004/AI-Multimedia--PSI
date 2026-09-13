FROM python:3.10-slim

WORKDIR /app

# Install runtime dependencies (ffmpeg for audio extraction, curl for healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/* /var/cache/apt/*

# Install pre-built Python binary wheels directly (avoids duplicate builder layer snapshots)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app

# Create unprivileged user for security best practices
RUN useradd -m -u 1000 appuser && \
    mkdir -p /app/uploads && \
    chown -R appuser:appuser /app

USER appuser

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/health || exit 1

CMD ["python", "start.py"]
