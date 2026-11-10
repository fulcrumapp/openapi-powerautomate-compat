# OpenAPI Power Automate Compatibility Tool

Converts OpenAPI 3.1 specifications to Swagger 2.0 format compatible with Microsoft Power Automate custom connectors.

> **Note:** This tool is pre-configured to convert the [Fulcrum API](https://github.com/fulcrumapp/api) by default, but can be used for **any OpenAPI 3.1 specification** by providing your own spec file and skipping the download step. See [Convert Your Own API](#convert-your-own-api) for details.

## Setup

### Requirements

- **Node.js 22+**, **Bash** and **curl** for conversion.
- **Java 11+** for local OpenAPI Generator validation.
- **paconn** only for authenticated Power Platform validation or deployment;
  it is not needed to generate the connector.

### Installation

```bash
# Conversion only: locked dependencies, no unused format adapters or validators
npm ci --omit=dev --omit=optional
./scripts/run_pipeline.sh --skip-validate

# Include developer tools when local validation is needed
npm ci --include=dev --omit=optional
./scripts/run_pipeline.sh --skip-paconn
```

`--skip-paconn` runs all local specification and package checks without
contacting Power Platform. The default pipeline still requires `paconn` and
authentication for its final certification check. Install it separately with
`python3 -m pip install paconn` only when that check or deployment is needed.
Python is only needed for that optional CLI; conversion and local-only
validation use Node.js and the existing `js-yaml` dependency, not pip or PyYAML.
See the [Power Platform Connector CLI documentation](https://learn.microsoft.com/en-us/connectors/custom-connectors/paconn-cli).

Conversion uses repository-local executables from `package-lock.json`; it
does not download tools through `npx` at runtime. `.npmrc` omits optional
dependencies by default. `swagger2openapi` is an explicit runtime dependency
because `api-spec-converter` requires it to register the OpenAPI 3 and
Swagger 2 formats, even for this downgrade direction. Commander 2 is shared
explicitly with the converter and its `z-schema` CLI dependency so an
incompatible hoisted Commander version is not used when optional packages
are omitted. RAML, API Blueprint, Google Discovery and Swagger 1 adapters
are not installed.

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
3. **Swagger Cleanup** - Filters endpoints, removes unsupported features, and
   adds Power Automate metadata (`swagger_cleaner.cjs`)
4. **Trigger Augmentation** - Adds Power Automate trigger extensions for
   webhooks (`trigger_augmenter.cjs`)
5. **Certification Packaging** - Generates Microsoft certification artifacts
   (`certification_packager.cjs`)

The download step recursively fetches referenced JSON/YAML schemas from the
selected repository and branch, preserving paths beneath the specification
directory. A reference cannot select a different host or escape that directory.

Before downgrading, `resolve_external_refs.cjs` resolves local external JSON/YAML
schemas relative to their containing files. Remote URLs, protocol-relative
URLs and absolute file references are rejected, including inside nested schemas;
conversion never fetches remote references. Internal references remain
references, including recursive models. Missing, invalid or circular external
references fail explicitly instead of producing an incomplete package.
External schemas therefore receive the same OpenAPI 3.1 downgrade as the
main document. Cleanup removes only definitions unreachable from the retained
operations and extensions; trigger augmentation supports both referenced and
inlined webhook request schemas.

The local compatibility scan reports remaining composition keywords for
review; it does not flatten `allOf` or guarantee acceptance by Power Platform.
Swagger CLI failures and all OpenAPI Generator warnings are fatal.

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

    Both targets use Node.js 26.13.0 on Debian 13 (Trixie), pulled from
    `public.ecr.aws/docker/library/node:26.13.0-trixie-slim` rather than
    Docker Hub. The default image contains conversion dependencies only, not
    Python, pip, validation CLIs, Java or `paconn`. Validation is skipped by
    default. Local execution still supports Node.js 22+.

    **For local validation in Docker (no Power Platform authentication):**

    ```bash
    docker build --target validation -t openapi-powerautomate-compat:validation .
    docker run --rm -v "$(pwd)/build:/app/build" \
      openapi-powerautomate-compat:validation
    ```

    This opt-in image includes the locked developer tools and Java. It runs
    local validation but explicitly skips `paconn`. OpenAPI Generator may
    download its configured JAR on first use; this is not part of conversion.

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

    **To convert offline (use an existing spec and its external schemas):**

    ```bash
    docker run --rm --network none -v "$(pwd)/build:/app/build" \
      openapi-powerautomate-compat --skip-download
    ```

### Option 3: Running Scripts Directly

```bash
# Run the complete pipeline
./scripts/run_pipeline.sh

# Or run individual steps
./scripts/download_fulcrum_api.sh
./scripts/convert_openapi.sh
./scripts/validate.sh

# Local checks only, without contacting Power Platform
./scripts/validate.sh --skip-paconn

# Offline regression fixtures and dependency-tree assertions
npm test
```

The transformation entry points use Node.js instead of the former Python
scripts. Cleaner and trigger augmentation accept JSON or YAML (based on the
input suffix) and retain that format in the output:

```bash
# Default output: swagger-2.0-cleaned.yaml; an explicit output is also supported
node scripts/swagger_cleaner.cjs build/swagger-2.0.yaml
node scripts/swagger_cleaner.cjs --list-endpoints build/swagger-2.0.yaml

# Update in-place, or supply a second path to write a separate output
node scripts/trigger_augmenter.cjs build/fulcrum-power-automate-connector.yaml

# Generate the same three certification files from the connector and config
node scripts/certification_packager.cjs \
  build/fulcrum-power-automate-connector.yaml \
  connector-config.yaml build/certified-connectors/Fulcrum
```

YAML formatting and JSON whitespace may differ from the former Python
serialization; connector data, configured metadata and generated README
content are unchanged.

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
