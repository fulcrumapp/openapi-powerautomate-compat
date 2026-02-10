#!/bin/bash
#
# Unified Pipeline Script
# 
# Runs the complete OpenAPI to Power Automate conversion pipeline:
# 1. Download - Fetch API spec and external schemas
# 2. Convert - Transform OpenAPI 3.1 → 3.0 → Swagger 2.0, clean, augment, package
# 3. Validate - Verify output meets all requirements
#
# Usage:
#   ./scripts/run_pipeline.sh [--skip-download] [--skip-validate]
#
# Environment Variables:
#   BRANCH - Git branch to download from (default: v2)
#   WORK_DIR - Output directory (default: ./build)
#
# Exit Codes:
#   0 - Success
#   1 - Pipeline failure
#

set -e

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

# Parse arguments
SKIP_DOWNLOAD=false
SKIP_VALIDATE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-download)
            SKIP_DOWNLOAD=true
            shift
            ;;
        --skip-validate)
            SKIP_VALIDATE=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [--skip-download] [--skip-validate]"
            echo ""
            echo "Options:"
            echo "  --skip-download  Skip the download step (use existing api-3.1.json)"
            echo "  --skip-validate  Skip the validation step"
            echo ""
            echo "Environment Variables:"
            echo "  BRANCH    Git branch to download from (default: v2)"
            echo "  WORK_DIR  Output directory (default: ./build)"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo "================================================"
echo "OpenAPI Power Automate Conversion Pipeline"
echo "================================================"
echo ""

# Step 1: Download
if [ "$SKIP_DOWNLOAD" = false ]; then
    echo "Step 1/3: Downloading API specification..."
    echo "------------------------------------------------"
    "${SCRIPT_DIR}/download_fulcrum_api.sh"
    echo ""
else
    echo "Step 1/3: Download skipped (--skip-download)"
    echo ""
fi

# Step 2: Convert
echo "Step 2/3: Converting and transforming..."
echo "------------------------------------------------"
"${SCRIPT_DIR}/convert_openapi.sh"
echo ""

# Step 3: Validate
if [ "$SKIP_VALIDATE" = false ]; then
    echo "Step 3/3: Validating output..."
    echo "------------------------------------------------"
    "${SCRIPT_DIR}/validate.sh"
else
    echo "Step 3/3: Validation skipped (--skip-validate)"
fi

echo ""
echo "================================================"
echo "✓ Pipeline completed successfully!"
echo "================================================"
