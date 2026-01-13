#!/bin/bash

set -e

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "${SCRIPT_DIR}/.." && pwd)
WORK_DIR_DEFAULT="${REPO_ROOT}/build"
WORK_DIR="${WORK_DIR:-${WORK_DIR_DEFAULT}}"

API_31_PATH="${WORK_DIR}/api-3.1.json"
API_30_PATH="${WORK_DIR}/api-3.0.json"
SWAGGER_PATH="${WORK_DIR}/swagger-2.0.yaml"
SWAGGER_CLEAN_PATH="${WORK_DIR}/fulcrum-power-automate-connector.yaml"

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

# Step 11: Validate certification package
echo "Step 11: Validating certification package..."
CERT_DIR="${WORK_DIR}/certified-connectors/Fulcrum"
CERT_API_DEF="${CERT_DIR}/apiDefinition.swagger.json"
CERT_API_PROPS="${CERT_DIR}/apiProperties.json"
CERT_README="${CERT_DIR}/README.md"

CERT_CHECKS_PASSED=true

# Check that all three files exist
if [ ! -f "${CERT_API_DEF}" ]; then
    echo -e "  ${RED}✗${NC} apiDefinition.swagger.json not found"
    CERT_CHECKS_PASSED=false
    VALIDATION_PASSED=false
else
    echo -e "  ${GREEN}✓${NC} apiDefinition.swagger.json exists"
fi

if [ ! -f "${CERT_API_PROPS}" ]; then
    echo -e "  ${RED}✗${NC} apiProperties.json not found"
    CERT_CHECKS_PASSED=false
    VALIDATION_PASSED=false
else
    echo -e "  ${GREEN}✓${NC} apiProperties.json exists"
fi

if [ ! -f "${CERT_README}" ]; then
    echo -e "  ${RED}✗${NC} README.md not found"
    CERT_CHECKS_PASSED=false
    VALIDATION_PASSED=false
else
    echo -e "  ${GREEN}✓${NC} README.md exists"
fi

# Validate JSON format
if [ -f "${CERT_API_DEF}" ]; then
    if command -v jq &> /dev/null; then
        if jq empty "${CERT_API_DEF}" 2>/dev/null; then
            echo -e "  ${GREEN}✓${NC} apiDefinition.swagger.json is valid JSON"
        else
            echo -e "  ${RED}✗${NC} apiDefinition.swagger.json is invalid JSON"
            CERT_CHECKS_PASSED=false
            VALIDATION_PASSED=false
        fi
    fi
fi

if [ -f "${CERT_API_PROPS}" ]; then
    if command -v jq &> /dev/null; then
        if jq empty "${CERT_API_PROPS}" 2>/dev/null; then
            echo -e "  ${GREEN}✓${NC} apiProperties.json is valid JSON"
            
            # Check for required fields
            if jq -e '.properties.connectionParameters' "${CERT_API_PROPS}" >/dev/null 2>&1; then
                echo -e "  ${GREEN}✓${NC} connectionParameters field present"
                
                # Check for hostUrl connection parameter
                if jq -e '.properties.connectionParameters.hostUrl' "${CERT_API_PROPS}" >/dev/null 2>&1; then
                    echo -e "  ${GREEN}✓${NC} hostUrl connection parameter present"
                    
                    # Validate hostUrl structure
                    if jq -e '.properties.connectionParameters.hostUrl.type' "${CERT_API_PROPS}" >/dev/null 2>&1 && \
                       jq -e '.properties.connectionParameters.hostUrl.uiDefinition' "${CERT_API_PROPS}" >/dev/null 2>&1; then
                        echo -e "  ${GREEN}✓${NC} hostUrl parameter has required fields"
                    else
                        echo -e "  ${RED}✗${NC} hostUrl parameter missing required fields"
                        CERT_CHECKS_PASSED=false
                        VALIDATION_PASSED=false
                    fi
                else
                    echo -e "  ${YELLOW}⚠${NC} hostUrl connection parameter not configured"
                fi
            else
                echo -e "  ${RED}✗${NC} connectionParameters field missing"
                CERT_CHECKS_PASSED=false
                VALIDATION_PASSED=false
            fi
            
            # Check for policy templates
            if jq -e '.properties.policyTemplateInstances' "${CERT_API_PROPS}" >/dev/null 2>&1; then
                echo -e "  ${GREEN}✓${NC} policyTemplateInstances field present"
                
                # Check if dynamichosturl policy is configured
                if jq -e '.properties.policyTemplateInstances[] | select(.templateId == "dynamichosturl")' "${CERT_API_PROPS}" >/dev/null 2>&1; then
                    echo -e "  ${GREEN}✓${NC} dynamichosturl policy template present"
                    
                    # Validate policy template structure
                    if jq -e '.properties.policyTemplateInstances[] | select(.templateId == "dynamichosturl") | .parameters."x-ms-apimTemplateParameter.urlTemplate"' "${CERT_API_PROPS}" >/dev/null 2>&1; then
                        URL_TEMPLATE=$(jq -r '.properties.policyTemplateInstances[] | select(.templateId == "dynamichosturl") | .parameters."x-ms-apimTemplateParameter.urlTemplate"' "${CERT_API_PROPS}")
                        
                        if [[ "$URL_TEMPLATE" =~ ^https:// ]] && [[ "$URL_TEMPLATE" =~ @connectionParameters\( ]]; then
                            echo -e "  ${GREEN}✓${NC} dynamichosturl URL template valid: ${URL_TEMPLATE}"
                        else
                            echo -e "  ${RED}✗${NC} dynamichosturl URL template invalid: ${URL_TEMPLATE}"
                            CERT_CHECKS_PASSED=false
                            VALIDATION_PASSED=false
                        fi
                    else
                        echo -e "  ${RED}✗${NC} dynamichosturl policy missing urlTemplate parameter"
                        CERT_CHECKS_PASSED=false
                        VALIDATION_PASSED=false
                    fi
                else
                    echo -e "  ${YELLOW}⚠${NC} dynamichosturl policy template not configured"
                fi
            else
                echo -e "  ${RED}✗${NC} policyTemplateInstances field missing"
                CERT_CHECKS_PASSED=false
                VALIDATION_PASSED=false
            fi
            
            if jq -e '.properties.iconBrandColor' "${CERT_API_PROPS}" >/dev/null 2>&1; then
                BRAND_COLOR=$(jq -r '.properties.iconBrandColor' "${CERT_API_PROPS}")
                if [[ "$BRAND_COLOR" =~ ^#[0-9A-Fa-f]{6}$ ]]; then
                    echo -e "  ${GREEN}✓${NC} iconBrandColor valid: ${BRAND_COLOR}"
                else
                    echo -e "  ${RED}✗${NC} iconBrandColor invalid format: ${BRAND_COLOR}"
                    CERT_CHECKS_PASSED=false
                    VALIDATION_PASSED=false
                fi
            else
                echo -e "  ${RED}✗${NC} iconBrandColor field missing"
                CERT_CHECKS_PASSED=false
                VALIDATION_PASSED=false
            fi
        else
            echo -e "  ${RED}✗${NC} apiProperties.json is invalid JSON"
            CERT_CHECKS_PASSED=false
            VALIDATION_PASSED=false
        fi
    fi
fi

# Validate README sections
if [ -f "${CERT_README}" ]; then
    README_CHECKS=true
    
    if grep -q "^# Fulcrum$" "${CERT_README}"; then
        echo -e "  ${GREEN}✓${NC} README has correct title"
    else
        echo -e "  ${RED}✗${NC} README missing title '# Fulcrum'"
        README_CHECKS=false
    fi
    
    REQUIRED_SECTIONS=(
        "## Publisher"
        "## Prerequisites"
        "## Known Issues and Limitations"
    )
    
    for section in "${REQUIRED_SECTIONS[@]}"; do
        if grep -q "^${section}" "${CERT_README}"; then
            echo -e "  ${GREEN}✓${NC} ${section} section found"
        else
            echo -e "  ${RED}✗${NC} ${section} section missing"
            README_CHECKS=false
        fi
    done
    
    if [ "$README_CHECKS" = false ]; then
        CERT_CHECKS_PASSED=false
        VALIDATION_PASSED=false
    fi
    
    # Check file size
    README_SIZE=$(wc -c < "${CERT_README}" | tr -d ' ')
    if [ "$README_SIZE" -lt 500 ]; then
        echo -e "  ${RED}✗${NC} README.md is too small (${README_SIZE} bytes)"
        CERT_CHECKS_PASSED=false
        VALIDATION_PASSED=false
    else
        echo -e "  ${GREEN}✓${NC} README.md size is reasonable (${README_SIZE} bytes)"
    fi
fi

if [ "$CERT_CHECKS_PASSED" = true ]; then
    echo -e "${GREEN}✓ Certification package built${NC}"
fi
echo ""

# Step 12: Run paconn validate
echo "Step 12: Running Power Automate connector validation (paconn)..."
echo "  (This validates the connector meets Power Automate certification requirements)"
echo ""

PACONN_CHECKS_PASSED=true

# Check if paconn is installed (try both direct command and python module)
if command -v paconn &> /dev/null; then
    PACONN_CMD="paconn"
elif python3 -m paconn --version &> /dev/null; then
    PACONN_CMD="python3 -m paconn"
else
    echo -e "${RED}✗ paconn not found${NC}"
    echo ""
    echo "paconn is required for Power Automate certification validation."
    echo ""
    echo "To install paconn:"
    echo "  pip3 install paconn"
    echo ""
    echo "After installation, run validation again:"
    echo "  ./scripts/validate.sh"
    echo ""
    echo "Documentation: https://learn.microsoft.com/en-us/connectors/custom-connectors/paconn-cli"
    PACONN_CHECKS_PASSED=false
    VALIDATION_PASSED=false
    PACONN_CMD=""
fi

if [ -n "$PACONN_CMD" ]; then
    # Run paconn validate on the certification directory
    echo "  Running: $PACONN_CMD validate --api-def ${CERT_API_DEF}"
    echo ""
    
    # Run the command and capture output to a temp file
    # Temporarily disable exit-on-error since paconn may return non-zero exit code
    PACONN_TEMP=$(mktemp)
    set +e
    eval "$PACONN_CMD validate --api-def \"${CERT_API_DEF}\"" > "${PACONN_TEMP}" 2>&1
    PACONN_EXIT_CODE=$?
    set -e
    PACONN_OUTPUT=$(cat "${PACONN_TEMP}")
    rm -f "${PACONN_TEMP}"
    
    # Display the output
    if [ -n "$PACONN_OUTPUT" ]; then
        echo "$PACONN_OUTPUT"
        echo ""
    fi
    
    # Check if validation failed
    if [ $PACONN_EXIT_CODE -ne 0 ]; then
        # Check if the error is authentication-related
        if echo "$PACONN_OUTPUT" | grep -qi "access token\|authentication\|login\|credentials\|unauthorized\|401"; then
            echo -e "${RED}✗ paconn validation FAILED - Authentication Required${NC}"
            echo ""
            echo "paconn requires authentication to Power Platform for validation."
            echo ""
            echo "To complete Step 12:"
            echo ""
            echo "  1. Login to Power Platform:"
            echo ""
            if [ "$PACONN_CMD" = "paconn" ]; then
                echo "       paconn login"
            else
                echo "       python3 -m paconn login"
            fi
            echo ""
            echo "  2. Follow the authentication prompts (browser will open)"
            echo ""
            echo "  3. After successful login, run validation again:"
            echo ""
            echo "       ./scripts/validate.sh"
            echo ""
            echo "Documentation: https://learn.microsoft.com/en-us/connectors/custom-connectors/paconn-cli"
        else
            echo -e "${RED}✗ paconn validation FAILED${NC}"
            echo ""
            echo "The connector does not meet Power Automate certification requirements."
            echo "Please review the errors above and fix them."
        fi
        PACONN_CHECKS_PASSED=false
        VALIDATION_PASSED=false
    else
        echo -e "${GREEN}✓ paconn validation PASSED${NC}"
    fi
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
