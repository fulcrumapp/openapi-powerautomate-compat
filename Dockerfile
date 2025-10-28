FROM public.ecr.aws/docker/library/python:3.9-slim-bookworm

# Prevent Python from writing .pyc files
ENV PYTHONDONTWRITEBYTECODE=1

# Install system dependencies (curl, gnupg, Node.js)
RUN apt-get update && apt-get install -y curl gnupg && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install Python project dependencies (globally in the image)
RUN pip install pyyaml

RUN npm install @apiture/openapi-down-convert api-spec-converter

# Copy application scripts
COPY scripts/convert_openapi.sh .
COPY scripts/swagger_cleaner.py scripts/

# Make convert_openapi.sh executable
RUN chmod +x convert_openapi.sh

# Set the entrypoint
ENTRYPOINT ["./convert_openapi.sh"]
