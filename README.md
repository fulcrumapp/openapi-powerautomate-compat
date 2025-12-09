# OpenAPI Power Automate Compatibility Tool

This tool facilitates the conversion of OpenAPI 3.0/3.1 specifications to the Swagger 2.0 (OpenAPI 2.0) format, with a focus on ensuring compatibility with Microsoft Power Automate. It applies the necessary transformations to meet Microsoft's validation requirements.

## Quick Start

### Convert Fulcrum API (Default)

Simply use the GitHub Copilot prompt:

```text
@workspace /convert
```

Or run the scripts directly:

```bash
./scripts/download_fulcrum_api.sh
./scripts/convert_openapi.sh
./scripts/validate.sh
```

> **Default:** Uses the `v2` branch (repository HEAD). Override with `BRANCH=branch-name` or use `@workspace /convert branch BRANCH_NAME`.

### Convert from a Specific Branch or Pull Request

To convert from a different branch (e.g., testing a PR):

```text
@workspace /convert branch spike/power-automate-testing
```

Or set the branch manually:

```bash
BRANCH="spike/power-automate-testing" ./scripts/download_fulcrum_api.sh
./scripts/convert_openapi.sh
./scripts/validate.sh
```

**For Pull Requests:**

1. Find the PR's branch name on GitHub (look for "wants to merge from **branch-name**")
2. Use that branch name:

   ```text
   @workspace /convert branch feature/new-endpoints
   ```

For detailed instructions and troubleshooting, see [.github/prompts/convert.prompt.md](.github/prompts/convert.prompt.md)

### What Gets Validated

The validation script (`./scripts/validate.sh`) checks:

- ✓ All required files exist
- ✓ File sizes are correct
- ✓ JSON/YAML structure is valid
- ✓ Swagger 2.0 specification passes validation
- ✓ No OpenAPI Generator warnings (warnings treated as errors)
- ✓ Power Automate compatibility requirements

All generated artifacts are written to `scripts/temp/build/` by default (configurable via the `WORK_DIR` environment variable).

### Convert Your Own API

```bash
# 1. Place your OpenAPI 3.1 specification in scripts/temp/build/
cp /path/to/your/api.json scripts/temp/build/api-3.1.json

# 2. Run the converter
./scripts/convert_openapi.sh

# 3. Validate the output
./scripts/validate.sh
```

### Working Directory

- Generated artifacts land in `scripts/temp/build/` by default.
- Override by exporting `WORK_DIR=/absolute/path` before running the scripts.
- All files in `scripts/temp/` are automatically gitignored.

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

2. **Run the Docker container:**

    Place your OpenAPI 3.1 specification file in `scripts/temp/build/` as `api-3.1.json`.

    ```bash
    docker run -v "$(pwd)/scripts/temp/build:/app" openapi-powerautomate-compat
    ```

### Option 3: Local Execution

- Clone this repository to your local machine.

- Add your OpenAPI 3.1 specification to `scripts/temp/build/` and name the file:
   `api-3.1.json`

**Example:**

![image](https://github.com/user-attachments/assets/757f1865-37b6-404f-bfab-c87784d5acef)

- Execute the tool using the following commands:

```bash
./scripts/convert_openapi.sh
./scripts/validate.sh
```

- Upon successful conversion, a confirmation message will be displayed.

- The output file, `scripts/temp/build/swagger-2.0-cleaned.yaml`, is the final result and should be ready for import into Microsoft Power Automate. For example:

![Power Automate Import Example](https://github.com/user-attachments/assets/fc9bbac6-44c5-46aa-9f55-32f9cc5e2794)

## Output Files

All files are generated in `scripts/temp/build/`:

- `api-3.1.json` - Input OpenAPI 3.1 specification
- `components/schemas/*.json` - External schema files (if applicable)
- `api-3.0.json` - Downgraded to OpenAPI 3.0
- `swagger-2.0.yaml` - Converted to Swagger 2.0
- `swagger-2.0-cleaned.yaml` - **Final output** ready for Power Automate import

All generated files are gitignored and can be safely deleted after import.

## For More Information

See [.github/prompts/convert.prompt.md](.github/prompts/convert.prompt.md) for:

- Detailed step-by-step instructions
- Troubleshooting guide
- Configuration options
- Converting different API specifications
