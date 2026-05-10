FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY backend/requirements.txt .
# If there are any missing dependencies like uvicorn in requirements.txt, ensure they are installed
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir uvicorn gunicorn

# Copy all source code
COPY backend/ ./backend/

# Set timezone for Japan so that APScheduler runs at 10:00 JST
ENV TZ=Asia/Tokyo
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Environment variables
ENV PYTHONUNBUFFERED=1

# Expose port
EXPOSE 8000

# Run FastAPI
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
