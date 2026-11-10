FROM public.ecr.aws/docker/library/node:26.13.0-trixie-slim AS conversion

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl jq && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install only the locked conversion dependencies, not validators or unused formats.
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev --omit=optional && \
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
