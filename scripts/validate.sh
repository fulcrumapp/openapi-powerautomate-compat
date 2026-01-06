#!/bin/bash

set -e

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
WORK_DIR_DEFAULT="${SCRIPT_DIR}/temp/build"
WORK_DIR="${WORK_DIR:-${WORK_DIR_DEFAULT}}"

API_31_PATH="${WORK_DIR}/api-3.1.json"
API_30_PATH="${WORK_DIR}/api-3.0.json"
SWAGGER_PATH="${WORK_DIR}/swagger-2.0.yaml"
SWAGGER_CLEAN_PATH="${WORK_DIR}/swagger-2.0-cleaned.yaml"

echo "================================================"
echo "OpenAPI Power Automate Compatibility Validation"
echo "================================================"
echo "Working directory: ${WORK_DIR}"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

VALIDATION_PASSED=true

# Step 1: Check required files exist
echo "Step 1: Checking required files..."
if [ ! -f "${API_31_PATH}" ]; then
    echo -e "${RED}✗ ${API_31_PATH} not found. Run ./download_fulcrum_api.sh first${NC}"
    exit 1
fi

if [ ! -f "${SWAGGER_CLEAN_PATH}" ]; then
    echo -e "${RED}✗ ${SWAGGER_CLEAN_PATH} not found. Run ./convert_openapi.sh first${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Required files exist${NC}"
echo ""

# Step 2: Check file sizes
echo "Step 2: Validating file sizes..."
API_SIZE=$(wc -c < "${API_31_PATH}" | tr -d ' ')
SWAGGER_SIZE=$(wc -c < "${SWAGGER_CLEAN_PATH}" | tr -d ' ')

echo "  ${API_31_PATH}: ${API_SIZE} bytes (expected ~260000)"
echo "  ${SWAGGER_CLEAN_PATH}: ${SWAGGER_SIZE} bytes (expected ~12000)"

if [ "$API_SIZE" -lt 100000 ]; then
    echo -e "${RED}✗ api-3.1.json is too small, may be corrupted${NC}"
    VALIDATION_PASSED=false
else
    echo -e "${GREEN}✓ File sizes look reasonable${NC}"
fi
echo ""

# Step 3: Validate JSON structure
echo "Step 3: Validating JSON structure..."
if command -v jq &> /dev/null; then
    if jq empty "${API_31_PATH}" 2>/dev/null; then
        echo -e "${GREEN}✓ ${API_31_PATH} is valid JSON${NC}"
    else
        echo -e "${RED}✗ ${API_31_PATH} is invalid JSON${NC}"
        VALIDATION_PASSED=false
    fi
else
    echo -e "${YELLOW}⚠ jq not found, skipping JSON validation${NC}"
fi
echo ""

# Step 4: Validate YAML structure
echo "Step 4: Validating YAML structure..."
if command -v python3 &> /dev/null; then
    if python3 -c "import yaml; yaml.safe_load(open('${SWAGGER_CLEAN_PATH}'))" 2>/dev/null; then
        echo -e "${GREEN}✓ ${SWAGGER_CLEAN_PATH} is valid YAML${NC}"
    else
        echo -e "${RED}✗ ${SWAGGER_CLEAN_PATH} is invalid YAML${NC}"
        VALIDATION_PASSED=false
    fi
else
    echo -e "${YELLOW}⚠ Python 3 not found, skipping YAML validation${NC}"
fi
echo ""

# Step 5: Validate Swagger 2.0 with Swagger CLI
echo "Step 5: Validating Swagger 2.0 specification..."
echo "  (This may take a moment on first run as it installs swagger-cli)"
echo ""

pushd "${WORK_DIR}" >/dev/null

if npm_config_yes=true npx swagger-cli validate "${SWAGGER_CLEAN_PATH##${WORK_DIR}/}" 2>&1 | grep -q "is valid"; then
    echo -e "${GREEN}✓ Swagger 2.0 validation PASSED${NC}"
else
    echo -e "${RED}✗ Swagger 2.0 validation FAILED${NC}"
    VALIDATION_PASSED=false
fi
echo ""

# Step 6: Check Swagger version
echo "Step 6: Verifying Swagger version..."
SWAGGER_VERSION=$(grep "swagger:" "${SWAGGER_CLEAN_PATH}" | head -1)
if echo "$SWAGGER_VERSION" | grep -q "2.0"; then
    echo -e "${GREEN}✓ Correct Swagger version: ${SWAGGER_VERSION}${NC}"
else
    echo -e "${RED}✗ Incorrect Swagger version: ${SWAGGER_VERSION}${NC}"
    VALIDATION_PASSED=false
fi
echo ""

# Step 7: Check for required fields
echo "Step 7: Checking required Swagger 2.0 fields..."
REQUIRED_FIELDS=("swagger:" "info:" "paths:" "host:")
ALL_FIELDS_PRESENT=true

for field in "${REQUIRED_FIELDS[@]}"; do
    if grep -q "^${field}" "${SWAGGER_CLEAN_PATH}"; then
        echo -e "  ${GREEN}✓${NC} ${field}"
    else
        echo -e "  ${RED}✗${NC} ${field} (missing)"
        ALL_FIELDS_PRESENT=false
        VALIDATION_PASSED=false
    fi
done

if [ "$ALL_FIELDS_PRESENT" = true ]; then
    echo -e "${GREEN}✓ All required fields present${NC}"
fi
echo ""

# Step 8: Check for Power Automate incompatibilities
echo "Step 8: Checking for Power Automate incompatibilities..."
INCOMPATIBLE_FEATURES=$(grep -n "oneOf\|anyOf\|allOf" "${SWAGGER_CLEAN_PATH}" | wc -l | tr -d ' ')

if [ "$INCOMPATIBLE_FEATURES" -gt 0 ]; then
    echo -e "${YELLOW}⚠ Found ${INCOMPATIBLE_FEATURES} potentially incompatible features (oneOf/anyOf/allOf)${NC}"
    echo "  These may need manual review for Power Automate compatibility"
else
    echo -e "${GREEN}✓ No known incompatible features found${NC}"
fi
echo ""

# Step 9: Check for OpenAPI Generator warnings
echo "Step 9: Checking for OpenAPI Generator warnings (treating warnings as errors)..."
echo "  (This may take a moment on first run as it installs openapi-generator-cli)"
echo ""

OPENAPI_OUTPUT=$(npm_config_yes=true npx @openapitools/openapi-generator-cli validate -i "${SWAGGER_CLEAN_PATH}" 2>&1)

# Check if there are warnings (look for "Warnings:" followed by indented lines with tabs)
if echo "$OPENAPI_OUTPUT" | grep -q "Warnings:"; then
    WARNINGS_SECTION=$(echo "$OPENAPI_OUTPUT" | sed -n '/Warnings:/,/^\[/p')
    # The warnings use tab indentation, so we look for lines starting with tab and hyphen
    WARNINGS_COUNT=$(echo "$WARNINGS_SECTION" | grep -c "^	-" || echo "0")

    echo -e "${RED}✗ Found ${WARNINGS_COUNT} warning(s) from OpenAPI Generator:${NC}"
    echo ""
    echo "$WARNINGS_SECTION"
    echo ""
    echo -e "${RED}Warnings are treated as errors. Please fix them before proceeding.${NC}"
    VALIDATION_PASSED=false
else
    echo -e "${GREEN}✓ No warnings found${NC}"
fi
echo ""

# Step 10: Verify Power Automate trigger extensions
echo "Step 10: Verifying Power Automate trigger extensions..."
TRIGGER_CHECKS_PASSED=true

# Check for x-ms-trigger
if grep -q "x-ms-trigger:" "${SWAGGER_CLEAN_PATH}"; then
    echo -e "  ${GREEN}✓${NC} x-ms-trigger extension found"
else
    echo -e "  ${RED}✗${NC} x-ms-trigger extension missing"
    TRIGGER_CHECKS_PASSED=false
    VALIDATION_PASSED=false
fi

# Check for x-ms-notification-url
if grep -q "x-ms-notification-url:" "${SWAGGER_CLEAN_PATH}"; then
    echo -e "  ${GREEN}✓${NC} x-ms-notification-url extension found"
else
    echo -e "  ${RED}✗${NC} x-ms-notification-url extension missing"
    TRIGGER_CHECKS_PASSED=false
    VALIDATION_PASSED=false
fi

# Check for x-ms-notification-content
if grep -q "x-ms-notification-content:" "${SWAGGER_CLEAN_PATH}"; then
    echo -e "  ${GREEN}✓${NC} x-ms-notification-content extension found"
else
    echo -e "  ${RED}✗${NC} x-ms-notification-content extension missing"
    TRIGGER_CHECKS_PASSED=false
    VALIDATION_PASSED=false
fi

# Check for FulcrumWebhookPayload schema
if grep -q "FulcrumWebhookPayload:" "${SWAGGER_CLEAN_PATH}"; then
    echo -e "  ${GREEN}✓${NC} FulcrumWebhookPayload schema defined"
else
    echo -e "  ${RED}✗${NC} FulcrumWebhookPayload schema missing"
    TRIGGER_CHECKS_PASSED=false
    VALIDATION_PASSED=false
fi

if [ "$TRIGGER_CHECKS_PASSED" = true ]; then
    echo -e "${GREEN}✓ All Power Automate trigger extensions present${NC}"
fi
echo ""

popd >/dev/null

# Final Summary
echo "================================================"
if [ "$VALIDATION_PASSED" = true ]; then
    echo -e "${GREEN}✓ ALL VALIDATIONS PASSED${NC}"
    echo ""
    echo "The ${SWAGGER_CLEAN_PATH} file is ready for import into Power Automate!"
    exit 0
else
    echo -e "${RED}✗ VALIDATION FAILED${NC}"
    echo ""
    echo "Please review the errors above and fix them before proceeding."
    exit 1
fi
