# OpenAPI Power Automate Compatibility Tool

Converts OpenAPI 3.1 specifications to Swagger 2.0 format compatible with Microsoft Power Automate custom connectors.

> **Note:** This tool is pre-configured to convert the [Fulcrum API](https://github.com/fulcrumapp/api) by default, but can be used for **any OpenAPI 3.1 specification** by providing your own spec file and skipping the download step. See [Convert Your Own API](#convert-your-own-api) for details.

## Setup

### Requirements

- **Python 3.x** - Used in the conversion process for YAML processing and transformations
- **paconn** (Power Platform Connectors CLI) - Used to validate and upload the connector to Power Automate

### Installation

```bash
# Install paconn via pip
pip install paconn

# Verify installation
paconn --version
```

For more information about paconn, see the [Power Platform Connector CLI documentation](https://learn.microsoft.com/en-us/connectors/custom-connectors/paconn-cli).

## Quick Start

### Convert Fulcrum API (Default Configuration)

The default pipeline downloads and converts the Fulcrum API. Simply use the GitHub Copilot prompt:

```text
@workspace /convert
```

Or run the pipeline directly:

```bash
./scripts/run_pipeline.sh
```

> **Default:** Uses the `v2` branch (repository HEAD). Override with `BRANCH=branch-name` or use `@workspace /convert branch BRANCH_NAME`.

### Convert from a Specific Branch or Pull Request

To convert from a different branch (e.g., testing a PR):

```text
@workspace /convert branch spike/power-automate-testing
```

Or set the branch manually:

```bash
BRANCH="spike/power-automate-testing" ./scripts/run_pipeline.sh
```

**For Pull Requests:**

1. Find the PR's branch name on GitHub (look for "wants to merge from **branch-name**")
2. Use that branch name:

   ```text
   @workspace /convert branch feature/new-endpoints
   ```

For detailed instructions and troubleshooting, see [.github/prompts/convert.prompt.md](.github/prompts/convert.prompt.md)

### What Gets Validated

The pipeline automatically validates:

- ✓ File structure and sizes
- ✓ JSON/YAML syntax
- ✓ Swagger 2.0 specification compliance
- ✓ Power Automate compatibility (no unsupported features)
- ✓ Power Automate trigger extensions present
- ✓ Microsoft certification package completeness
- ✓ Zero OpenAPI Generator warnings

All generated artifacts are written to `build/` by default (configurable via the `WORK_DIR` environment variable).

### Conversion Pipeline

The conversion process performs these steps:

1. **OpenAPI 3.1 → 3.0** - Downgrades using `@apiture/openapi-down-convert`
2. **OpenAPI 3.0 → Swagger 2.0** - Converts using `api-spec-converter`
3. **Swagger Cleanup** - Filters endpoints, removes unsupported features, and adds Power Automate metadata (`swagger_cleaner.py`)
4. **Trigger Augmentation** - Adds Power Automate trigger extensions for webhooks (`trigger_augmenter.py`)
5. **Certification Packaging** - Generates Microsoft certification artifacts (`certification_packager.py`)

### Convert Your Own API

You can convert any OpenAPI 3.1 specification in two ways:

**Option A: Download from a GitHub repository**

Set environment variables to download from any GitHub repository:

```bash
REPO_OWNER="your-org" REPO_NAME="your-repo" BRANCH="main" ./scripts/run_pipeline.sh
```

| Variable | Default | Description |
|----------|---------|-------------|
| `REPO_OWNER` | `fulcrumapp` | GitHub repository owner |
| `REPO_NAME` | `api` | GitHub repository name |
| `BRANCH` | `v2` | Git branch name |

**Option B: Use a local spec file**

```bash
# 1. Place your OpenAPI 3.1 specification in build/
cp /path/to/your/api.json build/api-3.1.json

# 2. Run the converter (skip download since you have the spec)
./scripts/run_pipeline.sh --skip-download
```

**Customizing the Conversion:**

For non-Fulcrum APIs, you may need to customize:

1. **`connector-config.yaml`** - Update publisher name, branding, and connector metadata

### Working Directory

By default, the pipeline uses `./build/` for all generated files. Override with:

```bash
WORK_DIR=/custom/path ./scripts/run_pipeline.sh
```

## Usage Instructions

### Option 1: Using GitHub Copilot Prompts (Recommended)

The easiest way to use this tool is with GitHub Copilot:

```text
@workspace /convert
```

This will:

1. Download the Fulcrum API from the v2 branch (default)
2. Convert it to Power Automate compatible format
3. Validate the output
4. Report any issues

**To convert from a specific branch:**

```text
@workspace /convert branch YOUR_BRANCH_NAME
```

### Option 2: Using Docker

1. **Build the Docker image:**

    ```bash
    docker build -t openapi-powerautomate-compat .
    ```

2. **Run the full pipeline:**

    ```bash
    docker run -v "$(pwd)/build:/app/build" openapi-powerautomate-compat
    ```

    This downloads the Fulcrum API and converts it to Power Automate compatible format. The results are written to `build/`.

    > **Note:** Validation is skipped when running in Docker because `paconn validate` requires interactive authentication which is not supported in containerized environments. Run `./scripts/validate.sh` locally after the Docker conversion completes to validate the output.

    **To convert from a specific branch:**

    ```bash
    docker run -v "$(pwd)/build:/app/build" -e BRANCH=feature-branch openapi-powerautomate-compat
    ```

    **To download from a different repository:**

    ```bash
    docker run -v "$(pwd)/build:/app/build" \
      -e REPO_OWNER=your-org \
      -e REPO_NAME=your-repo \
      -e BRANCH=main \
      openapi-powerautomate-compat
    ```

    **To skip download (use existing spec):**

    ```bash
    docker run -v "$(pwd)/build:/app/build" openapi-powerautomate-compat --skip-download
    ```

### Option 3: Running Scripts Directly

```bash
# Run the complete pipeline
./scripts/run_pipeline.sh

# Or run individual steps
./scripts/download_fulcrum_api.sh
./scripts/convert_openapi.sh
./scripts/validate.sh
```

## Output Files

The conversion pipeline produces the following files in `build/`:

### Intermediate Files

- `api-3.1.json` - Input OpenAPI 3.1 specification
- `components/schemas/*.json` - External schema files (if applicable)
- `api-3.0.json` - Downgraded to OpenAPI 3.0
- `swagger-2.0.yaml` - Converted to Swagger 2.0 (before cleanup)
- `fulcrum-power-automate-connector.yaml` - Cleaned Swagger 2.0 with Power Automate trigger extensions

### Final Output

- **`certified-connectors/Fulcrum/`** - Microsoft certification package ready for Power Automate import:
  - `apiDefinition.swagger.json` - Connector definition in JSON format
  - `apiProperties.json` - Connection parameters and branding
  - `README.md` - Connector documentation

All generated files are gitignored and can be safely deleted after import.

## Certification Package

The tool automatically generates a complete Microsoft Power Platform certification package ready for submission to the [PowerPlatformConnectors repository](https://github.com/microsoft/PowerPlatformConnectors).

The icon used for the connector can be found in the assets directory.

### Customizing Connector Metadata

Edit `connector-config.yaml` at the repository root to customize:

- Publisher name and support contact
- Branding (icon color)
- Authentication configuration
- Connector version (required - see below)
- README documentation sections
- Prerequisites and limitations

**Example:**

```yaml
publisher: Fulcrum
displayName: Fulcrum
version: "1.0.0"  # Required - set connector version
iconBrandColor: "#F4F4F4"
category: Field Productivity
supportEmail: support@fulcrumapp.com

connectionParameters:
  api_key:
    type: securestring
    uiDefinition:
      displayName: API Token
      description: Your Fulcrum API token for authentication

prerequisites:
  - Active Fulcrum subscription with API access enabled

knownLimitations:
  - Rate limiting applies based on your Fulcrum plan
```

After editing, run `./scripts/convert_openapi.sh` to regenerate the certification package.

**Note:** Keep prerequisites and limitations concise. Avoid mentioning specific plan types or redundant setup instructions.

### Configuring Connector Version

The `version` field in `connector-config.yaml` is **required** and controls the version number displayed in Power Automate. This allows you to manage the connector version independently from the underlying API specification version.

**Use cases:**
- **Connector iteration**: Improving the connector (better descriptions, metadata fixes) with independent version tracking
- **Semantic versioning**: Using semantic versioning (e.g., "1.0.0") for the connector

**Example:**

```yaml
# Required: Set the connector version
version: "1.0.0"
```

The version appears in the `info.version` field of the packaged `apiDefinition.swagger.json` file.

## Deploying as a Custom Connector

You can deploy the generated connector directly to your Microsoft tenant as a custom connector using the Power Platform Connectors CLI (`paconn`).

### Prerequisites

1. **paconn installed** (see [Installation](#installation))
2. **Power Automate license** with custom connector permissions
3. **Completed conversion** (run `./scripts/run_pipeline.sh` first)

### First-Time Deployment

1. **Login to Power Platform:**

   ```bash
   paconn login
   ```

   This opens a browser for Microsoft authentication. Sign in with your Power Platform account.

2. **Create the connector:**

   ```bash
   paconn create --api-def build/certified-connectors/Fulcrum/apiDefinition.swagger.json \
                 --api-prop build/certified-connectors/Fulcrum/apiProperties.json
   ```

3. **Save the settings file:**

   After successful creation, paconn generates a `settings.json` file. Keep this file in the repository root for future updates.

### Updating an Existing Connector

If you have a `settings.json` file from a previous deployment:

```bash
paconn update --settings settings.json
```

This updates the connector in your tenant with the latest build.

### Using GitHub Copilot Agent

For guided assistance with paconn commands, use the `paconn` Copilot agent by selecting it from the Copilot mode selector:

The agent can help you:

- Login and authenticate
- Create new connectors
- Update existing connectors
- Troubleshoot deployment issues

## Certification Submission

Reference the following on how to submit a connector for certification:

- https://learn.microsoft.com/en-us/connectors/custom-connectors/submit-for-certification
- https://learn.microsoft.com/en-us/connectors/custom-connectors/certification-submission

## For More Information

See [.github/prompts/convert.prompt.md](.github/prompts/convert.prompt.md) for:

- Detailed step-by-step instructions
- Troubleshooting guide
- Configuration options
- Converting different API specifications
