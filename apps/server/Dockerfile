FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Install uv
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:${PATH}"

WORKDIR /app

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install dependencies system-wide using uv
RUN uv sync --system

# Copy application code
COPY . .

# Set default port to 8000, but allow override via Render/Koyeb environment variable
ENV PORT=8000

# Run uvicorn on the configured port
CMD uvicorn main:app --host 0.0.0.0 --port $PORT
