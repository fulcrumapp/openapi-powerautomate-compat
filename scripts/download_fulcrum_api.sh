#!/bin/bash

set -e

# Resolve repository root so we can work inside a dedicated workspace directory
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "${SCRIPT_DIR}/.." && pwd)
WORK_DIR_DEFAULT="${REPO_ROOT}/build"
WORK_DIR="${WORK_DIR:-${WORK_DIR_DEFAULT}}"

mkdir -p "${WORK_DIR}"
WORK_DIR=$(cd "${WORK_DIR}" && pwd)

# Configuration - all values can be overridden with environment variables
REPO_OWNER="${REPO_OWNER:-fulcrumapp}"
REPO_NAME="${REPO_NAME:-api}"
BRANCH="${BRANCH:-v2}"
API_SPEC_PATH="reference/rest-api.json"
OUTPUT_FILE="api-3.1.json"
OUTPUT_PATH="${WORK_DIR}/${OUTPUT_FILE}"

echo "Working directory: ${WORK_DIR}"
echo ""

echo "Downloading Fulcrum API specification from ${REPO_OWNER}/${REPO_NAME}..."
echo "Branch: ${BRANCH}"
echo "File: ${API_SPEC_PATH}"
echo ""

# Construct the raw GitHub URL
RAW_URL="https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/${API_SPEC_PATH}"

# Download the main API spec file
echo "Downloading main API specification..."
curl --fail --location --output "${OUTPUT_PATH}" "${RAW_URL}"

if [ ! -f "${OUTPUT_PATH}" ]; then
    echo "Error: Failed to download ${OUTPUT_PATH}"
    exit 1
fi

# Check file size
FILE_SIZE=$(wc -c < "${OUTPUT_PATH}" | tr -d ' ')
echo "✓ Downloaded ${OUTPUT_PATH} (${FILE_SIZE} bytes)"

# Validate it's valid JSON
if command -v jq &> /dev/null; then
    if ! jq empty "${OUTPUT_PATH}" 2>/dev/null; then
        echo "✗ Invalid JSON - file may be corrupted"
        exit 1
    fi
fi

echo ""
echo "Downloading external schema files..."
node "${SCRIPT_DIR}/download_schemas.cjs" "${OUTPUT_PATH}" "${RAW_URL}"

echo ""
echo "✓ Download complete!"
echo ""
echo "Files downloaded:"
echo "  - ${OUTPUT_PATH}"
echo "  - Referenced schema files alongside the specification"
echo ""
echo "Ready to convert! Run ./convert_openapi.sh to proceed."
