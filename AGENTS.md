<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# Agent Instructions for OpenAPI Power Automate Compatibility Tool

## Required Validation Steps

When making changes to this repository, you **MUST** run the complete download, convert, and validation workflow to ensure the conversion pipeline is working correctly.

## Code Quality Standards

This repository enforces strict quality standards:

1. **Zero Validation Warnings**: All OpenAPI Generator CLI warnings are treated as errors and must be fixed
2. **Zero Markdown Linting Errors**: All `.md` files must pass markdown linting without errors
3. **Correct File Locations**: Prompt files must live under `.github/prompts/` (e.g., `.github/prompts/convert.prompt.md` per [GitHub documentation](https://docs.github.com/en/copilot/tutorials/customization-library/prompt-files/your-first-prompt-file))

These standards are automatically checked by `./scripts/validate.sh`.

## Quick Start: Automated Validation

The easiest way to validate everything in one command:

```bash
./scripts/validate.sh
```

This script automatically:

- ✓ Checks all required files exist
- ✓ Validates file sizes
- ✓ Validates JSON/YAML structure
- ✓ Runs Swagger CLI validation
- ✓ Verifies Swagger version
- ✓ Checks required fields
- ✓ Scans for Power Automate incompatibilities
- ✓ **Checks for OpenAPI Generator warnings (treats warnings as ERRORS)**
- ✓ **Verifies Power Automate trigger extensions are present**
- ✓ **Validates Microsoft certification package (Step 11)**
- ✓ **Runs paconn validate for Power Automate certification (Step 12)**
- ✓ Provides clear pass/fail results

**Expected Output:**

```text
================================================
✓ ALL VALIDATIONS PASSED

The fulcrum-power-automate-connector.yaml file is ready for import into Power Automate!
================================================
```

If you need to run individual steps or debug issues, use the manual workflow below.

## Complete Validation Workflow (Manual)

### Step 1: Clean Environment

```bash
# Remove all generated files to start fresh
rm -rf components/ api-3.1.json api-3.0.json swagger-2.0.yaml fulcrum-power-automate-connector.yaml
```

### Step 2: Download

```bash
# Download the Fulcrum API specification and all external schemas
./scripts/download_fulcrum_api.sh
```

**Expected Output:**

- ✓ Downloaded api-3.1.json (should be ~254KB)
- ✓ Downloaded 28 schema files
- No errors

### Step 3: Convert

```bash
# Run the conversion pipeline
./scripts/convert_openapi.sh
```

**Expected Output:**

- OpenAPI 3.1 → 3.0 conversion completes
- OpenAPI 3.0 → Swagger 2.0 conversion completes
- Cleanup script runs successfully
- Trigger augmentation script runs successfully
- Certification packaging completes successfully
- Success message with output file locations

**Expected Files Created:**

- `api-3.0.json` (~254KB)
- `swagger-2.0.yaml` (~220KB)
- `fulcrum-power-automate-connector.yaml` (~12KB, includes Power Automate trigger extensions)
- **Certification package in `build/certified-connectors/Fulcrum/`:**
  - `apiDefinition.swagger.json` (~44KB, JSON format)
  - `apiProperties.json` (~500 bytes, connection parameters and branding)
  - `README.md` (~1.5KB, Microsoft certification template)

### Step 4: Validate OpenAPI 3.0

Validate the intermediate OpenAPI 3.0 specification:

```bash
# Using OpenAPI Generator CLI
npx @openapitools/openapi-generator-cli validate -i api-3.0.json
```

**Expected Output:**

- **Known Issue**: External schema references may cause warnings/errors during validation
- The OpenAPI 3.0 file contains external `$ref` to `./components/schemas/*.json` files
- These errors do not prevent successful conversion to Swagger 2.0
- Example warnings: "Failed to get the schema name: ./components/schemas/WebhookRequest.json"
- This is expected behavior and can be ignored if Step 5 passes

**Alternative**: Skip this validation and proceed directly to Step 5 (Swagger 2.0 validation)

### Step 5: Validate Swagger 2.0

Validate the final Swagger 2.0 specification:

```bash
# Using OpenAPI Generator CLI
npx @openapitools/openapi-generator-cli validate -i fulcrum-power-automate-connector.yaml

# Using Swagger CLI
npx swagger-cli validate fulcrum-power-automate-connector.yaml
```

**Expected Output:**

- **CRITICAL**: Must report "fulcrum-power-automate-connector.yaml is valid"
- No critical errors
- The conversion process successfully resolves external schema references
- Swagger CLI may show deprecation warnings (can be ignored)

### Step 6: Verify Power Automate Compatibility

Check for Power Automate-specific requirements:

```bash
# Check that the file is valid YAML
python3 -c "import yaml; yaml.safe_load(open('fulcrum-power-automate-connector.yaml'))"

# Verify Swagger version
grep "swagger:" fulcrum-power-automate-connector.yaml

# Verify required fields exist
grep -E "(swagger:|info:|paths:|host:)" fulcrum-power-automate-connector.yaml

# Verify Power Automate trigger extensions
grep "x-ms-trigger:" fulcrum-power-automate-connector.yaml
grep "x-ms-notification-url:" fulcrum-power-automate-connector.yaml
grep "x-ms-notification-content:" fulcrum-power-automate-connector.yaml
grep "FulcrumWebhookPayload:" fulcrum-power-automate-connector.yaml

# Verify Location header for webhook management (required for Power Automate trigger lifecycle)
grep -A 5 "'201':" fulcrum-power-automate-connector.yaml | grep -A 3 "headers:" | grep "Location:"

# Verify DELETE endpoint is marked as internal (required for Power Automate trigger cleanup)
grep -A 10 "DELETE /v2/webhooks/{webhook_id}" fulcrum-power-automate-connector.yaml | grep "x-ms-visibility: internal"

# Verify certification package files
ls -lh build/certified-connectors/Fulcrum/
```

**Expected Output:**

- No Python errors
- `swagger: '2.0'` is present
- All required fields exist
- All Power Automate trigger extensions are present (`x-ms-trigger`, `x-ms-notification-url`, `x-ms-notification-content`)
- `FulcrumWebhookPayload` schema is defined
- **Certification package directory contains 3 files:** `apiDefinition.swagger.json`, `apiProperties.json`, `README.md`

## Validation Checklist

Before committing changes, verify:

- [ ] `./scripts/download_fulcrum_api.sh` completes without errors
- [ ] All 28 schema files are downloaded
- [ ] `./scripts/convert_openapi.sh` completes successfully
- [ ] `fulcrum-power-automate-connector.yaml` passes Swagger CLI validation with "is valid" message
- [ ] **ZERO validation warnings** from OpenAPI Generator CLI (warnings are treated as errors)
- [ ] **Power Automate trigger extensions are present** (`x-ms-trigger`, `x-ms-notification-url`, `x-ms-notification-content`)
- [ ] **FulcrumWebhookPayload schema is defined** in the cleaned spec
- [ ] **Location header is present** in webhook POST 201 response (required for Power Automate to delete webhooks when flows are removed)
- [ ] **DELETE webhook endpoint has `x-ms-visibility: internal`** (required for Power Automate trigger cleanup without exposing as user action)
- [ ] **Certification package is generated** in `build/certified-connectors/Fulcrum/`
- [ ] **All three certification files exist:** `apiDefinition.swagger.json`, `apiProperties.json`, `README.md`
- [ ] **Certification files pass validation** (Step 11 in validate.sh)
- [ ] **paconn validate passes** (Step 12 in validate.sh)
- [ ] **ZERO markdown linting errors** in all .md files
- [ ] File sizes are reasonable (api-3.1.json ~260KB, fulcrum-power-automate-connector.yaml ~12KB)
- [ ] All generated files are listed in `.gitignore`
- [ ] Prompt files are in `.github/prompts/` (NOT `.prompt.md` in root)

**Note**: OpenAPI 3.0 validation (Step 4) may report errors due to external schema references. These can be ignored if the final Swagger 2.0 validation passes.

## Common Issues and Solutions

### Download Issues

**Problem:** Schema files fail to download (404 errors)

- **Solution:** Verify the branch and file paths in `scripts/download_fulcrum_api.sh`
- **Check:** Does the file exist at `https://github.com/fulcrumapp/api/tree/spike/power-automate-testing/reference/components/schemas/`?

**Problem:** Invalid JSON downloaded

- **Solution:** Check internet connection and GitHub availability
- **Verify:** Run `jq empty api-3.1.json` to validate JSON

### Conversion Issues

**Problem:** OpenAPI 3.1 → 3.0 fails

- **Cause:** Unsupported 3.1 features
- **Check:** Review error message for specific feature causing failure
- **Tool:** `@apiture/openapi-down-convert`

**Problem:** OpenAPI 3.0 → Swagger 2.0 fails

- **Cause:** External schema references not found
- **Check:** Verify `components/schemas/*.json` files exist
- **Tool:** `api-spec-converter`

**Problem:** Cleanup script fails

- **Cause:** Missing PyYAML or invalid YAML
- **Solution:** `pip install pyyaml`
- **Verify:** `python3 -c "import yaml; print(yaml.__version__)"`

**Problem:** Trigger augmentation script fails

- **Cause:** Missing webhook endpoint in spec or invalid YAML
- **Check:** Verify `POST /v2/webhooks.json` exists in `swagger-2.0.yaml`
- **Verify:** Check that PyYAML is installed
- **Debug:** Run `python3 scripts/trigger_augmenter.py fulcrum-power-automate-connector.yaml` manually

**Problem:** Certification packager fails

- **Cause:** Missing or invalid `connector-config.yaml`
- **Check:** Verify `connector-config.yaml` exists at repository root
- **Verify:** Check that required fields are present (publisher, displayName, iconBrandColor, etc.)
- **Debug:** Run `python3 scripts/certification_packager.py build/fulcrum-power-automate-connector.yaml connector-config.yaml build/certified-connectors/Fulcrum` manually

### Validation Issues

**Problem:** OpenAPI Generator CLI not found

- **Solution:** Install globally: `npm install -g @openapitools/openapi-generator-cli`
- **Alternative:** Use npx: `npx @openapitools/openapi-generator-cli`

**Problem:** paconn not found

- **Solution:** Install via pip: `pip install paconn`
- **Note:** paconn is required for Power Automate certification validation (Step 12)
- **Documentation:** [Power Platform Connector CLI](https://learn.microsoft.com/en-us/connectors/custom-connectors/paconn-cli)

**Problem:** paconn authentication required

- **Solution:** Run `paconn login` (or `python3 -m paconn login`) to authenticate with Power Platform
- **Note:** Authentication is required to complete Step 12 validation
- **After login:** Run `./scripts/validate.sh` again to complete validation

**Problem:** Validation reports errors

- **Action:** Document the errors
- **Assess:** Are they critical or just warnings?
- **For Swagger 2.0:** Some 3.0 features may not be supported

## Testing Different API Specifications

To test with a different API specification:

1. Update `scripts/download_fulcrum_api.sh` configuration:

   ```bash
   REPO_OWNER="your-org"
   REPO_NAME="your-repo"
   BRANCH="your-branch"
   API_SPEC_PATH="path/to/spec.json"
   SCHEMAS_BASE_PATH="path/to/schemas"  # if external schemas exist
   ```

2. Run the complete validation workflow (Steps 1-6 above)

3. Document any new issues or required adjustments to the conversion pipeline

## Modifying the Conversion Pipeline

When making changes to:

- `scripts/download_fulcrum_api.sh`
- `scripts/convert_openapi.sh`
- `scripts/swagger_cleaner.py`
- `scripts/trigger_augmenter.py`
- `scripts/certification_packager.py`
- `connector-config.yaml`
- Dockerfile

You **MUST**:

1. Run the complete validation workflow
2. Compare before/after results
3. Document any changes in behavior
4. Update this AGENTS.md file if validation steps change

## Success Criteria

A successful validation run must:

1. Complete all 6 steps without critical errors
2. Produce valid Swagger 2.0 output
3. Generate a file size comparable to reference sizes
4. Pass both OpenAPI Generator and Swagger CLI validation
5. Be importable into Power Automate (manual verification recommended)

## Reporting Issues

When reporting issues:

1. Include which validation step failed
2. Provide complete error messages
3. Document the state of generated files
4. Include validation output from both tools
5. Note any differences from expected output

## Additional Validation Tools

Optional but recommended:

```bash
# Check for specific Power Automate incompatibilities
grep -n "oneOf\|anyOf\|allOf" fulcrum-power-automate-connector.yaml

# Verify no OpenAPI 3.x features remain
grep -n "OpenAPI\|3\\.0\|3\\.1" fulcrum-power-automate-connector.yaml

# Count endpoints
grep -c "operationId:" fulcrum-power-automate-connector.yaml

# Check for required security schemes
grep -A5 "securityDefinitions:" fulcrum-power-automate-connector.yaml
```

## Version Information

Document the versions of tools used:

```bash
node --version
python3 --version
npx @openapitools/openapi-generator-cli version
npx swagger-cli --version
npx @apiture/openapi-down-convert --version
npx api-spec-converter --version
```

This ensures reproducibility and helps diagnose version-specific issues.

## Connector Configuration

The `connector-config.yaml` file at the repository root contains metadata used to generate Microsoft certification artifacts. This file centralizes all connector-specific information in one place.

### Configuration Structure

```yaml
# Required fields
publisher: Fulcrum
displayName: Fulcrum
description: |
  Multi-line description used in README
iconBrandColor: "#EB1300"  # Hex color for Power Automate branding
supportEmail: support@fulcrumapp.com

# README sections
prerequisites:
  - Active Fulcrum subscription with API access enabled

knownLimitations:
  - Rate limiting applies based on your Fulcrum plan

# Optional sections
gettingStarted: |
  Instructions for creating a connection
faqs:
  - question: How do I get an API token?
    answer: Log in to Fulcrum, navigate to Settings > API, and generate a new token.
```

### Customizing Connector Metadata

To update connector branding, documentation, or authentication:

1. Edit `connector-config.yaml` at the repository root
2. Run `./scripts/convert_openapi.sh` to regenerate certification files
3. Run `./scripts/validate.sh` to verify changes

**Note:** Keep prerequisites and limitations concise. Avoid mentioning specific plan types or redundant setup instructions between "Obtaining Credentials" and "Getting Started" sections.
