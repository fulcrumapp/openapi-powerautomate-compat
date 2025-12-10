#!/bin/bash

set -e

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "${SCRIPT_DIR}/.." && pwd)
WORK_DIR_DEFAULT="${SCRIPT_DIR}/temp/build"
WORK_DIR="${WORK_DIR:-${WORK_DIR_DEFAULT}}"

API_31_PATH="${WORK_DIR}/api-3.1.json"
API_30_PATH="${WORK_DIR}/api-3.0.json"
SWAGGER_PATH="${WORK_DIR}/swagger-2.0.yaml"
SWAGGER_CLEAN_PATH="${WORK_DIR}/swagger-2.0-cleaned.yaml"

if [[ ! -f "${API_31_PATH}" ]]; then
    echo "Error: ${API_31_PATH} not found! Run download_fulcrum_api.sh first."
    exit 1
fi

pushd "${WORK_DIR}" >/dev/null

# OpenAPI 3.1 to OpenAPI 3.0
if ! npm_config_yes=true npx @apiture/openapi-down-convert --input "${API_31_PATH##${WORK_DIR}/}" --output "${API_30_PATH##${WORK_DIR}/}"; then
    echo "Error: OpenAPI 3.1 to 3.0 conversion failed!"
    popd >/dev/null
    exit 1
fi

# OpenAPI 3.0 to Swagger 2.0
if ! npm_config_yes=true npx api-spec-converter --from=openapi_3 --to=swagger_2 --syntax=yaml "${API_30_PATH##${WORK_DIR}/}" > "${SWAGGER_PATH##${WORK_DIR}/}"; then
    echo "Error: OpenAPI 3.0 to Swagger 2.0 conversion failed!"
    popd >/dev/null
    exit 1
fi

# Run swagger_cleaner.py
# pyyaml is installed globally in the Docker image
if ! python3 "${SCRIPT_DIR}/swagger_cleaner.py" "${SWAGGER_PATH}"; then
    echo "Error: swagger_cleaner.py execution failed!"
    popd >/dev/null
    exit 1
fi

popd >/dev/null

echo "Conversion and cleaning completed successfully!"
echo "Output files are in ${WORK_DIR}:"
echo "  - ${API_30_PATH}"
echo "  - ${SWAGGER_PATH}"
echo "  - ${SWAGGER_CLEAN_PATH}"
