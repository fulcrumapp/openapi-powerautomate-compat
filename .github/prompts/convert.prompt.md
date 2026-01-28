````prompt
# Fulcrum API Conversion Prompt

This document provides instructions for downloading and converting the Fulcrum API OpenAPI specification to a format compatible with Microsoft Power Automate.

## Quick Start - Default Configuration

To convert using the default configuration:

```bash
# Clean the build directory first
rm -rf build/

# Run the conversion pipeline
./scripts/download_fulcrum_api.sh
./scripts/convert_openapi.sh
./scripts/validate.sh
```

**Default settings:**

- Repository: `fulcrumapp/api`
- Branch: `v2` (the repository's default/HEAD branch)
- API Spec: `reference/rest-api.json`
- Schema Path: `reference/components/schemas`

## Custom Configuration Options

### Option 1: Convert from a Specific Branch

To download from a different branch, set the `BRANCH` variable before running:

```bash
BRANCH="spike/power-automate-testing" ./scripts/download_fulcrum_api.sh
```

### Option 2: Convert from a Pull Request

To test a specific pull request, use the PR's head branch:

```bash
# Find the branch name from the PR page, then use it
BRANCH="feature/new-endpoints" ./scripts/download_fulcrum_api.sh
```

You can find the branch name:

1. Go to the PR page: `https://github.com/fulcrumapp/api/pull/PR_NUMBER`
2. Look for "wants to merge commits into main from **branch-name**"
3. Use that branch name

### Option 3: Convert from a Different Repository

Edit `scripts/download_fulcrum_api.sh` and modify these variables:

```bash
REPO_OWNER="your-org"           # GitHub repository owner
REPO_NAME="your-repo"           # GitHub repository name
BRANCH="main"                   # Git branch name
API_SPEC_PATH="path/to/spec.json"         # Path to OpenAPI spec
SCHEMAS_BASE_PATH="path/to/schemas"       # Path to external schemas (optional)
```

## Prerequisites

- bash shell
- curl
- Node.js and npm (for conversion tools)
- Python 3 with PyYAML (for cleanup script)
- (Optional) jq for JSON validation

## Step 0: Clean the Build Directory (Recommended)

Before starting the conversion, clean any existing build artifacts:

```bash
rm -rf build/
```

This ensures you're working with a fresh state and prevents issues from stale files.

## Step 1: Download the Fulcrum API Specification

Download the OpenAPI 3.1 specification from the Fulcrum API repository:

```bash
./scripts/download_fulcrum_api.sh
```

This script will:
- Download `rest-api.json` from the `fulcrumapp/api` repository
- Use the configured branch (default: `main`)
- Save it as `api-3.1.json` in `build/`
- Download all external schema files
- Validate that the downloaded files are valid JSON

## Step 2: Convert to Power Automate Compatible Format

Run the conversion pipeline:

```bash
./scripts/convert_openapi.sh
```

This script performs three conversions:
1. **OpenAPI 3.1 → OpenAPI 3.0**: Downgrades version (Power Automate doesn't support 3.1)
2. **OpenAPI 3.0 → Swagger 2.0**: Converts to older format (required by Power Automate)
3. **Cleanup**: Applies Power Automate-specific transformations and removes unused models

## Step 3: Validate the Output

Validate that the conversion was successful:

```bash
./scripts/validate.sh
```

This validation script checks:
- ✓ All required files exist
- ✓ File sizes are reasonable
- ✓ JSON/YAML structure is valid
- ✓ Swagger 2.0 specification passes validation
- ✓ No OpenAPI Generator warnings (treats warnings as errors)
- ✓ Power Automate compatibility requirements met

## Step 4: Import to Power Automate

1. Open Power Automate: https://make.powerautomate.com
2. Go to **Data** → **Custom connectors** → **New custom connector** → **Import an OpenAPI file**
3. Upload `build/fulcrum-power-automate-connector.yaml`
4. Configure and test your connector

## Output Files

All files are generated in `build/` (configurable via `WORK_DIR` environment variable):

- `api-3.1.json` - Downloaded OpenAPI 3.1 specification
- `components/schemas/*.json` - External schema files
- `api-3.0.json` - Downgraded to OpenAPI 3.0
- `swagger-2.0.yaml` - Converted to Swagger 2.0
- `fulcrum-power-automate-connector.yaml` - **Final output** ready for Power Automate

## Troubleshooting

### Download Issues

If download fails:
1. Check internet connection
2. Verify the branch exists in the repository
3. Check if the file path is correct in the repository
4. Ensure you have access to the repository (public repos don't need authentication)

**To verify branch/file exists:**
```bash
# For main branch
curl -I "https://raw.githubusercontent.com/fulcrumapp/api/main/reference/rest-api.json"

# For a specific branch
curl -I "https://raw.githubusercontent.com/fulcrumapp/api/BRANCH_NAME/reference/rest-api.json"
```

### Conversion Issues

If conversion fails:
1. Ensure `api-3.1.json` is valid JSON
2. Check that Node.js packages are available:
   ```bash
   npx @apiture/openapi-down-convert --version
   npx api-spec-converter --version
   ```
3. Verify Python and PyYAML are installed:
   ```bash
   python3 --version
   python3 -c "import yaml; print(yaml.__version__)"
   ```

### Validation Issues

If validation fails:
1. Review the specific error messages from `./scripts/validate.sh`
2. Check that all required files were generated in `build/`
3. Ensure no OpenAPI Generator warnings (warnings are treated as errors)
4. Verify file sizes are reasonable (~260KB for api-3.1.json, ~12KB for fulcrum-power-automate-connector.yaml)

### Power Automate Import Issues

Common issues and solutions:
- **"Invalid OpenAPI file"**: Ensure you're using `fulcrum-power-automate-connector.yaml`
- **"Unsupported features"**: The cleanup script should handle most issues automatically
- **Large file size**: Power Automate has size limits; consider reducing endpoints

## Clean Up

To remove all generated files:

```bash
rm -rf build/
```

## Advanced Usage

### Custom Working Directory

Override the default working directory:

```bash
export WORK_DIR=/path/to/custom/directory
./scripts/download_fulcrum_api.sh
./scripts/convert_openapi.sh
./scripts/validate.sh
```

### Testing Multiple Branches

```bash
# Clean first
rm -rf build/

# Test main branch
BRANCH="main" ./scripts/download_fulcrum_api.sh
./scripts/convert_openapi.sh
./scripts/validate.sh

# Clean up
rm -rf build/

# Test a feature branch
BRANCH="feature/new-endpoints" ./scripts/download_fulcrum_api.sh
./scripts/convert_openapi.sh
./scripts/validate.sh
```

## Notes

- All temporary and output files are in `build/` and are gitignored
- The download script is idempotent - safe to run multiple times
- External schema references are automatically downloaded and resolved
- Unused models are automatically detected and removed during cleanup
- Set `BRANCH` environment variable to test different branches or PRs without editing files
