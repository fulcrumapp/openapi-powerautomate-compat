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

# Copy package.json and install Node.js project dependencies into /app/node_modules
COPY package.json ./
COPY package-lock.json* ./ # Good practice to copy if it exists
RUN npm install # This creates /app/node_modules in the image layer

# Declare /app/node_modules as a volume.
# This ensures that the node_modules from the image are used and are not
# created on the host, even if the script re-runs npm install.
# Writes will go to an anonymous volume managed by Docker.
VOLUME /app/node_modules

# Copy application scripts
COPY convert_openapi.sh .
COPY swagger_cleaner.py .

# Make convert_openapi.sh executable
RUN chmod +x convert_openapi.sh

# Set the entrypoint
ENTRYPOINT ["./convert_openapi.sh"]
