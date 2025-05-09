FROM public.ecr.aws/docker/library/python:3.9-slim-bookworm

# Install dependencies
RUN apt-get update && apt-get install -y curl gnupg && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g swagger-cli@4.0.4 && \
    curl -L https://github.com/mikefarah/yq/releases/download/v4.18.1/yq_linux_amd64 -o /usr/local/bin/yq && \
    chmod +x /usr/local/bin/yq && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy scripts
COPY convert_openapi.sh .
COPY swagger_cleaner.py .

# Make convert_openapi.sh executable
RUN chmod +x convert_openapi.sh

# Set the entrypoint
ENTRYPOINT ["./convert_openapi.sh"]
