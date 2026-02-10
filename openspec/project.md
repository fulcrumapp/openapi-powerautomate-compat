# Project Context

## Purpose

This tool converts OpenAPI 3.0/3.1 specifications to Swagger 2.0 (OpenAPI 2.0) format, with a focus on ensuring compatibility with Microsoft Power Automate. It applies necessary transformations to meet Microsoft's validation requirements, specifically targeting the Fulcrum API specification.

Key goals:
- Download OpenAPI 3.1 specs from the Fulcrum API repository
- Convert OpenAPI 3.1 → 3.0 → Swagger 2.0
- Clean and transform the spec to remove Power Automate incompatibilities
- Validate the output passes all checks with zero warnings

## Tech Stack

### Languages
- **Bash** - Shell scripts for orchestration (`download_fulcrum_api.sh`, `convert_openapi.sh`, `validate.sh`)
- **Python 3.9+** - Transformation logic (`swagger_cleaner.py`)
- **YAML/JSON** - OpenAPI specification formats

### Tools & Libraries
- **Node.js 22.x** - Runtime for npm packages
- **@apiture/openapi-down-convert** - OpenAPI 3.1 → 3.0 conversion
- **api-spec-converter** - OpenAPI 3.0 → Swagger 2.0 conversion
- **@openapitools/openapi-generator-cli 7.18.0** - Specification validation
- **swagger-cli** - Additional Swagger validation
- **PyYAML** - Python YAML parsing and generation
- **Docker** - Containerized execution environment

### Infrastructure
- **GitHub Actions** - CI/CD (via GitHub Copilot prompts)
- **Docker** - Reproducible build environment

## Project Conventions

### Code Style

**Bash Scripts:**
- Use `set -e` for strict error handling
- Use `SCRIPT_DIR` and `REPO_ROOT` for path resolution
- Support `WORK_DIR` environment variable override
- Use `pushd`/`popd` for directory changes
- Prefix output with `✓` for success, `✗` for failure, `⚠` for warnings

**Python:**
- Use type hints for function signatures
- Use docstrings for all functions
- Constants in UPPER_SNAKE_CASE (e.g., `ENDPOINTS_TO_KEEP`)
- Functions in snake_case

### Architecture Patterns

**Pipeline Architecture:**
1. **Download** (`download_fulcrum_api.sh`) - Fetches spec and external schemas from GitHub
2. **Convert** (`convert_openapi.sh`) - Three-stage conversion pipeline + transformations
3. **Validate** (`validate.sh`) - Multi-step validation with strict warnings-as-errors

**Unified Entry Point:**
- `run_pipeline.sh` - Single script that orchestrates all steps (download → convert → validate)
- Supports `--skip-download` and `--skip-validate` flags
- Used by Docker, CI/CD, and manual execution

**Transformation Scripts:**
- `swagger_cleaner.py` - Filters endpoints, removes incompatibilities, adds metadata
- `trigger_augmenter.py` - Adds Power Automate webhook trigger extensions
- `certification_packager.py` - Generates Microsoft certification artifacts

**File Organization:**
- Scripts in `scripts/`
- Generated files in `build/` (gitignored)
- GitHub Copilot prompts in `.github/prompts/`
- OpenSpec change proposals in `openspec/`

### Testing Strategy

**Validation-Based Testing:**
- No unit test framework; validation is the test suite
- `validate.sh` performs comprehensive checks:
  - File existence and size validation
  - JSON/YAML structure validation
  - Swagger CLI validation
  - OpenAPI Generator CLI validation (warnings = errors)
  - Power Automate compatibility checks (no `oneOf`/`anyOf`/`allOf`)
  - Required field presence verification
  - Certification package completeness

**Manual Testing:**
- Import certification package into Microsoft Power Automate

### Git Workflow

- **Default branch:** `main`
- **Branching:** Feature branches for changes
- **Validation:** Must pass `./scripts/run_pipeline.sh` before merge
- **Generated files:** All artifacts in `build/` are gitignored

## Domain Context

### OpenAPI/Swagger Specifications

- **OpenAPI 3.1** - Latest spec version, supports JSON Schema Draft 2020-12
- **OpenAPI 3.0** - Widely supported, uses JSON Schema Draft 07
- **Swagger 2.0** - Legacy format required by Power Automate

### Power Automate Limitations

- Does not support `oneOf`, `anyOf`, `allOf` constructs
- Requires Swagger 2.0 format specifically
- Needs `host`, `basePath`, and `schemes` fields
- Operations need unique `operationId` values

### Fulcrum API

- REST API for Fulcrum data collection platform
- Source specification at `fulcrumapp/api` repository
- Uses external `$ref` to schema files in `components/schemas/`
- Target endpoints configured in `connector-config.yaml`

## Important Constraints

### Quality Standards

- **Zero validation warnings** - OpenAPI Generator warnings are treated as errors
- **Zero markdown linting errors** - All `.md` files must pass linting
- **Correct file locations** - Prompts must be in `.github/prompts/`

### Technical Constraints

- External schema references must be resolved during conversion
- Swagger 2.0 does not support all OpenAPI 3.x features
- File sizes expected: `api-3.1.json` ~260KB, `fulcrum-power-automate-connector.yaml` ~12KB

### Environment Requirements

- Node.js 22.x for npm packages
- Python 3.9+ with PyYAML
- Bash shell (zsh compatible)
- Optional: jq for JSON validation

## External Dependencies

### GitHub Repositories

- **fulcrumapp/api** - Source OpenAPI specification
  - Branch: `v2` (default) or override with `BRANCH` env var
  - Path: `reference/rest-api.json`
  - Schemas: `reference/components/schemas/*.json`

### npm Packages (via npx)

- `@apiture/openapi-down-convert` - 3.1→3.0 conversion
- `api-spec-converter` - 3.0→2.0 conversion
- `@openapitools/openapi-generator-cli` - Validation
- `swagger-cli` - Swagger validation

### Python Packages

- `pyyaml` - YAML processing

### Target Platform

- **Microsoft Power Automate** - Final import destination for certification package
