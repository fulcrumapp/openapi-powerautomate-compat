FROM public.ecr.aws/docker/library/python:3.9-slim-bookworm AS conversion

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

# Install only the locked conversion dependencies, not validators or unused formats.
COPY package.json package-lock.json .npmrc requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt && \
    npm ci --omit=dev --omit=optional && \
    npm cache clean --force

ENV PATH="/app/node_modules/.bin:${PATH}"

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

# Opt-in developer image; none of these tools are in the default conversion image.
FROM conversion AS validation
RUN apt-get update && apt-get install -y --no-install-recommends default-jre-headless && \
    rm -rf /var/lib/apt/lists/* && \
    npm ci --include=dev --omit=optional && \
    npm cache clean --force
COPY openapitools.json .
COPY tests/ tests/
ENTRYPOINT ["scripts/run_pipeline.sh", "--skip-paconn"]

FROM conversion AS runtime
