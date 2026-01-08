#!/bin/bash

set -e

# Resolve repository root so we can work inside a dedicated workspace directory
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "${SCRIPT_DIR}/.." && pwd)
WORK_DIR_DEFAULT="${REPO_ROOT}/build"
WORK_DIR="${WORK_DIR:-${WORK_DIR_DEFAULT}}"

mkdir -p "${WORK_DIR}"

# Configuration
REPO_OWNER="fulcrumapp"
REPO_NAME="api"
# Default to v2 (the repository's HEAD/default branch), can be overridden with BRANCH environment variable
BRANCH="${BRANCH:-v2}"
API_SPEC_PATH="reference/rest-api.json"
SCHEMAS_BASE_PATH="reference/components/schemas"
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
curl -L -o "${OUTPUT_PATH}" "${RAW_URL}"

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

# Extract unique external schema references
echo ""
echo "Downloading external schema files..."
COMPONENTS_DIR="${WORK_DIR}/components/schemas"
mkdir -p "${COMPONENTS_DIR}"

# Get list of external schema files referenced in the spec
SCHEMA_FILES=$(grep -o '"\./components/schemas/[^"]*"' "${OUTPUT_PATH}" | sort -u | sed 's/"//g' | sed 's|./components/schemas/||')

if [ -z "$SCHEMA_FILES" ]; then
    echo "No external schema files found"
else
    SCHEMA_COUNT=0
    for schema_file in $SCHEMA_FILES; do
        SCHEMA_URL="https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/${SCHEMAS_BASE_PATH}/${schema_file}"
        OUTPUT_SCHEMA_PATH="${COMPONENTS_DIR}/${schema_file}"

        if curl -f -s -L -o "${OUTPUT_SCHEMA_PATH}" "${SCHEMA_URL}"; then
            SCHEMA_COUNT=$((SCHEMA_COUNT + 1))
            echo "  ✓ ${schema_file}"
        else
            echo "  ✗ Failed to download ${schema_file}"
            exit 1
        fi
    done
    echo "✓ Downloaded ${SCHEMA_COUNT} schema files"
fi

echo ""
echo "✓ Download complete!"
echo ""
echo "Files downloaded:"
echo "  - ${OUTPUT_PATH}"
if [ -n "$SCHEMA_FILES" ]; then
    echo "  - ${SCHEMA_COUNT} schema files in ${COMPONENTS_DIR}/"
fi
echo ""
echo "Ready to convert! Run ./convert_openapi.sh to proceed."
