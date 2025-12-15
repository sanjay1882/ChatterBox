# Use official Python image
FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Copy requirements
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt gunicorn

# Copy app source
COPY scraper.py .
COPY .env . 

# Expose port
EXPOSE 3001

# Start command using Gunicorn for production
# Workers = 1 is usually enough for simple scraping, increase if needed
CMD ["gunicorn", "--bind", "0.0.0.0:3001", "scraper:app"]
