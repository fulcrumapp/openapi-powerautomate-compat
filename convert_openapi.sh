#!/bin/bash

set -e

# Check OpenAPI 3.1 file
if [[ ! -f "api-3.1.json" ]]; then
    echo "Error: api-3.1.json not found!"
    exit 1
fi

# OpenAPI 3.1 to OpenAPI 3.0
if ! npx @apiture/openapi-down-convert --input api-3.1.json --output api-3.0.json; then
    echo "Error: OpenAPI 3.1 to 3.0 conversion failed!"
    exit 1
fi

# OpenAPI 3.0 to Swagger 2.0
if ! npx api-spec-converter --from=openapi_3 --to=swagger_2 --syntax=yaml api-3.0.json > swagger-2.0.yaml; then
    echo "Error: OpenAPI 3.0 to Swagger 2.0 conversion failed!"
    exit 1
fi

# Run swagger_cleaner.py
# pyyaml is installed globally in the Docker image
if ! python swagger_cleaner.py swagger-2.0.yaml; then
    echo "Error: swagger_cleaner.py execution failed!"
    exit 1
fi

echo "Conversion and cleaning completed successfully!"
