FROM public.ecr.aws/docker/library/python:3.9-slim-bookworm

# Prevent Python from writing .pyc files
ENV PYTHONDONTWRITEBYTECODE=1

# Install system dependencies (curl, gnupg, Node.js, jq)
RUN apt-get update && apt-get install -y curl gnupg jq && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install Python project dependencies (globally in the image)
RUN pip install pyyaml

# Install npm packages globally for conversion and validation
RUN npm install -g @apiture/openapi-down-convert api-spec-converter swagger-cli @openapitools/openapi-generator-cli

# Copy all application scripts
COPY scripts/ scripts/

# Copy connector configuration
COPY connector-config.yaml .

# Make scripts executable
RUN chmod +x scripts/*.sh

# Set the working directory for output
ENV WORK_DIR=/app/build

# Allow passing BRANCH as environment variable
# Usage: docker run -e BRANCH=feature-branch ...

# Skip validation by default since paconn authentication is not supported in Docker
ENTRYPOINT ["scripts/run_pipeline.sh", "--skip-validate"]

