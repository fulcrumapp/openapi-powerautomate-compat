---
mode: agent
description: Convert Fulcrum API specification to Power Automate compatible format
---

# Fulcrum API Conversion Prompt

This document provides instructions for downloading and converting the Fulcrum API OpenAPI specification to a format compatible with Microsoft Power Automate.

## Quick Start - Default Configuration

To convert using the default configuration:

```bash
./scripts/run_pipeline.sh
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
BRANCH="spike/power-automate-testing" ./scripts/run_pipeline.sh
```

### Option 2: Convert from a Pull Request

To test a specific pull request, use the PR's head branch:

```bash
# Find the branch name from the PR page, then use it
BRANCH="feature/new-endpoints" ./scripts/run_pipeline.sh
```

You can find the branch name:

1. Go to the PR page: `https://github.com/fulcrumapp/api/pull/PR_NUMBER`
2. Look for "wants to merge commits into main from **branch-name**"
3. Use that branch name

### Option 3: Skip Download (Use Existing Spec)

If you already have `api-3.1.json` in the build directory:

```bash
./scripts/run_pipeline.sh --skip-download
```

### Option 4: Skip Validation (Debug Mode)

To only download and convert without validation:

```bash
./scripts/run_pipeline.sh --skip-validate
```

### Option 5: Convert from a Different Repository

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

## Pipeline Steps

The `run_pipeline.sh` script executes these steps:

### Step 1: Download (unless `--skip-download`)

Downloads the OpenAPI 3.1 specification from the Fulcrum API repository:

- Downloads `rest-api.json` from the `fulcrumapp/api` repository
- Uses the configured branch (default: `v2`)
- Saves it as `api-3.1.json` in `build/`
- Downloads all external schema files
- Validates that the downloaded files are valid JSON

### Step 2: Convert

Runs the conversion pipeline:

1. **OpenAPI 3.1 → OpenAPI 3.0**: Downgrades version (Power Automate doesn't support 3.1)
2. **OpenAPI 3.0 → Swagger 2.0**: Converts to older format (required by Power Automate)
3. **Cleanup**: Applies Power Automate-specific transformations and removes unused models
4. **Trigger Augmentation**: Adds Power Automate webhook trigger extensions
5. **Certification Packaging**: Generates Microsoft certification artifacts

### Step 3: Validate (unless `--skip-validate`)

Validates that the conversion was successful:

- ✓ All required files exist
- ✓ File sizes are reasonable
- ✓ JSON/YAML structure is valid
- ✓ Swagger 2.0 specification passes validation
- ✓ No OpenAPI Generator warnings (treats warnings as errors)
- ✓ Power Automate compatibility requirements met
- ✓ Microsoft certification package is complete

## Output Files

All files are generated in `build/` (configurable via `WORK_DIR` environment variable):

- `api-3.1.json` - Downloaded OpenAPI 3.1 specification
- `components/schemas/*.json` - External schema files
- `api-3.0.json` - Downgraded to OpenAPI 3.0
- `swagger-2.0.yaml` - Converted to Swagger 2.0
- `fulcrum-power-automate-connector.yaml` - Cleaned and augmented for Power Automate
- `certified-connectors/Fulcrum/` - **Final output** Microsoft certification package:
  - `apiDefinition.swagger.json`
  - `apiProperties.json`
  - `README.md`

## Import to Power Automate

1. Open Power Automate: https://make.powerautomate.com
2. Go to **Data** → **Custom connectors** → **New custom connector** → **Import an OpenAPI file**
3. Upload `build/certified-connectors/Fulcrum/apiDefinition.swagger.json`
4. Configure and test your connector

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

1. Ensure `build/api-3.1.json` is valid JSON
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

1. Review the specific error messages
2. Check that all required files were generated in `build/`
3. Ensure no OpenAPI Generator warnings (warnings are treated as errors)
4. Verify file sizes are reasonable (~260KB for api-3.1.json, ~12KB for fulcrum-power-automate-connector.yaml)

### Power Automate Import Issues

Common issues and solutions:

- **"Invalid OpenAPI file"**: Ensure you're using `apiDefinition.swagger.json` from the certification package
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
WORK_DIR=/path/to/custom/directory ./scripts/run_pipeline.sh
```

### Running Individual Steps

For debugging, you can run individual steps:

```bash
# Step 1: Download only
./scripts/download_fulcrum_api.sh

# Step 2: Convert only
./scripts/convert_openapi.sh

# Step 3: Validate only
./scripts/validate.sh
```

### Testing Multiple Branches

```bash
# Test main branch
rm -rf build/
BRANCH="main" ./scripts/run_pipeline.sh

# Test a feature branch
rm -rf build/
BRANCH="feature/new-endpoints" ./scripts/run_pipeline.sh
```

## Notes

- All temporary and output files are in `build/` and are gitignored
- The pipeline is idempotent - safe to run multiple times
- External schema references are automatically downloaded and resolved
- Unused models are automatically detected and removed during cleanup
- Set `BRANCH` environment variable to test different branches or PRs without editing files
