# Design: Microsoft Certification Packaging

## Overview

This design adds automated generation of Microsoft Power Platform certification artifacts as the final step in the conversion pipeline. The solution follows the existing pipeline pattern: configuration → transformation → validation.

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    Conversion Pipeline                           │
├─────────────────────────────────────────────────────────────────┤
│  download → 3.1→3.0 → 3.0→2.0 → clean → augment → [PACKAGE]    │
└─────────────────────────────────────────────────────────────────┘
                                                        │
                                                        ▼
                                        ┌───────────────────────────┐
                                        │ certification_packager.py │
                                        └───────────────────────────┘
                                                        │
                        ┌───────────────────────────────┼───────────────────────────────┐
                        ▼                               ▼                               ▼
            ┌────────────────────────┐    ┌────────────────────────┐    ┌────────────────────────┐
            │ apiDefinition.         │    │ apiProperties.json     │    │ README.md              │
            │ swagger.json           │    │                        │    │                        │
            │                        │    │ - connectionParameters │    │ - Prerequisites        │
            │ (YAML → JSON)          │    │ - iconBrandColor       │    │ - Obtaining Credentials│
            │                        │    │ - capabilities         │    │ - Supported Operations │
            └────────────────────────┘    └────────────────────────┘    └────────────────────────┘
```

### Data Flow

1. **Input**: `fulcrum-power-automate-connector.yaml` (from trigger augmenter)
2. **Configuration**: `connector-config.yaml` (repository root)
3. **Processing**: `certification_packager.py` reads both inputs
4. **Output**: Three files in `build/certified-connectors/Fulcrum/`

### Configuration Schema

The `connector-config.yaml` file centralizes all connector metadata:

```yaml
# Required fields
publisher: Fulcrum
displayName: Fulcrum
description: |
  Fulcrum is a mobile data collection platform for field teams.
  This connector enables integration with Fulcrum's API for managing
  field data, photos, videos, and more.
iconBrandColor: "#EB1300"
category: Field Productivity
supportEmail: support@fulcrumapp.com
supportUrl: https://www.fulcrumapp.com/support

# Authentication configuration (for apiProperties.json)
authentication:
  type: apiKey
  parameterName: x-apitoken
  displayName: Fulcrum API Token
  description: Your Fulcrum API token from the settings page
  tooltip: Get your API token from https://web.fulcrumapp.com/settings/api

# README.md sections
prerequisites:
  - Active Fulcrum subscription with API access enabled

knownLimitations:
  - Rate limiting applies based on your Fulcrum plan

# Optional README sections
gettingStarted: |
  Create a new connection in Power Automate and enter your API token when prompted.

faqs:
  - question: How do I get an API token?
    answer: Log in to Fulcrum, navigate to Settings > API, and generate a new token.

deploymentInstructions: |
  To deploy this connector as a custom connector:
  1. Download the apiDefinition.swagger.json file
  2. In Power Automate, go to Data > Custom Connectors
  3. Click "New custom connector" > "Import an OpenAPI file"
  4. Select the downloaded file and follow the wizard

# Documentation
documentationUrl: https://developer.fulcrumapp.com
```

## Implementation Decisions

### Why a Single Configuration File?

**Decision**: Use `connector-config.yaml` rather than embedding values in templates or multiple config files.

**Rationale**:
- Single source of truth for all connector metadata
- Easier to maintain and update (one file to edit)
- Human-readable YAML format is easier to edit than JSON
- Supports validation against a schema
- Can be version-controlled with clear change history
- Consistent with other YAML files in the project (swagger specs, Docker compose, etc.)

**Alternatives considered**:
- Template files with placeholders: More files to maintain, harder to validate
- Hardcoded values in Python: Requires code changes for metadata updates
- Multiple config files: Fragments single source of truth

### Why Python for Packaging?

**Decision**: Implement `certification_packager.py` in Python rather than Bash + jq.

**Rationale**:
- Consistent with existing tools (`swagger_cleaner.py`, `trigger_augmenter.py`)
- PyYAML already installed and used in pipeline
- Better JSON manipulation than Bash + jq for complex structures
- Easier to generate formatted markdown
- Can leverage Python's template string formatting
- Better error handling and validation capabilities

### Why Generate README vs Template?

**Decision**: Generate README.md dynamically using Microsoft's certified connector template structure, populating sections from `connector-config.yaml` and extracting operations from the spec.

**Template Source**: https://github.com/microsoft/PowerPlatformConnectors/blob/dev/templates/certified-connectors/readme.md

**Rationale**:
- Follows Microsoft's required structure for certified connectors
- Operations list stays synchronized with spec automatically
- Reduces manual maintenance when endpoints change
- Ensures documentation accuracy and compliance with certification requirements
- Can include operation counts, categorization, parameter details
- Populates required sections (Prerequisites, Obtaining Credentials, etc.) from config

**Template Structure** (with Fulcrum title):

```markdown
# Fulcrum
{description from connector-config.yaml}

## Publisher: {publisher from connector-config.yaml}
Required. Company or organization name.

## Prerequisites
{prerequisites from connector-config.yaml - concise list without plan specifics}

## Supported Operations
{Generated from swagger spec operations - concise list}

## Obtaining Credentials
{Generated from authentication section - where to get credentials, not how to use them}

## Getting Started
{Optional - how to create connection and use credentials, not how to obtain them}

## Known Issues and Limitations
{knownLimitations from connector-config.yaml - concise list without plan specifics}

## Frequently Asked Questions
{Optional - can be added to connector-config.yaml as FAQ array}

## Deployment Instructions
{Standard instructions for deploying as custom connector}
```

**Configuration Mapping**:
- Title: Hardcoded as "Fulcrum"
- Description: `connector-config.yaml: description`
- Publisher: `connector-config.yaml: publisher`
- Prerequisites: `connector-config.yaml: prerequisites[]`
- Supported Operations: Extracted from `paths` in swagger spec
- Obtaining Credentials: Generated from `connector-config.yaml: authentication`
- Known Issues: `connector-config.yaml: knownLimitations[]`
- Deployment Instructions: Standard template text

**Trade-off**: Generated READMEs follow strict template structure but ensure compliance with Microsoft certification requirements.

### Output Directory Structure

**Decision**: Use `build/certified-connectors/Fulcrum/` structure.

**Rationale**:
- Matches Microsoft PowerPlatformConnectors repository structure
- Easy to submit: copy entire `Fulcrum/` directory to fork
- Supports potential future multiple connector packaging
- Clear namespace separation from other build artifacts
- Consistent with Microsoft's conventions for certified connectors

### File Format: JSON vs YAML for apiDefinition

**Decision**: Convert YAML to JSON for `apiDefinition.swagger.json`.

**Rationale**:
- Microsoft's schema explicitly expects `.json` extension
- Power Platform's import tool may not handle YAML
- Examples in PowerPlatformConnectors repository use JSON
- JSON is more universally supported in tooling
- Conversion is straightforward: PyYAML can load YAML and output JSON

## Validation Strategy

### Pre-Generation Validation

Before generating files, validate:
- `connector-config.yaml` exists and is valid YAML
- Required config fields are present
- Input Swagger YAML file exists and is valid

### Post-Generation Validation

After generating files, validate:
- All three files exist with correct names
- `apiDefinition.swagger.json` is valid JSON
- `apiProperties.json` contains required Microsoft fields
- `README.md` contains required sections
- File sizes are reasonable (not empty, not truncated)

### Schema Validation (Future Enhancement)

Could add JSON Schema validation against Microsoft's schemas:
- `schemas/apiDefinition.swagger.schema.json`
- `schemas/paconn-apiProperties.schema.json`

## Error Handling

### Configuration Errors

If `connector-config.yaml` is missing or invalid:
- Print clear error message with expected location
- Provide example config structure
- Exit with non-zero status code
- Do not generate partial files

### Conversion Errors

If YAML → JSON conversion fails:
- Report specific parsing error
- Indicate which line/field caused failure
- Preserve input file for debugging
- Exit without creating output directory

### README Generation Errors

If operations cannot be parsed:
- Generate README with placeholder operations section
- Include warning comment in generated file
- Log warning but continue (non-fatal)
- Still produces usable apiDefinition and apiProperties files

## Testing Approach

### Manual Testing

1. Run full pipeline with default Fulcrum config
2. Verify generated files manually against Microsoft examples
3. Test import into Power Platform (if access available)

### Validation Testing

1. Test with missing config file
2. Test with invalid JSON in config
3. Test with missing required config fields
4. Test with malformed input YAML
5. Verify validation script catches all error cases

### Configuration Testing

1. Modify each config field
2. Verify changes appear in correct output files
3. Test edge cases (empty arrays, special characters in strings)
4. Test YAML-specific features (multi-line strings, comments)

## Future Enhancements

### Icon Support

**Current**: No icon file handling (Phase 1)
**Future**: Add icon file support
- Accept `icon.png` path in config
- Copy icon to certification output directory
- Validate icon dimensions (32x32, 64x64, etc.)
- Validate PNG format

### Custom Code Support

**Current**: No custom code/scripting
**Future**: Add script.csx support for Power Platform policies
- Configuration option for script file path
- Include script.csx in output directory
- Document policy template usage

### Multi-Connector Support

**Current**: Single connector (Fulcrum) hardcoded
**Future**: Support multiple connectors from same pipeline
- Array of connector configs
- Generate separate directories per connector
- Batch validation

### Interactive Configuration

**Current**: Manual YAML editing
**Future**: CLI tool for config generation
- Interactive prompts for required fields
- Validation during input
- Generate initial `connector-config.yaml`

## Security Considerations

### Sensitive Data

**No secrets in config**: `connector-config.yaml` must not contain:
- API keys or tokens
- Client secrets
- OAuth credentials
- Private URLs

**Client IDs OK**: OAuth client IDs can be in config (not secret)

### Validation

- Scan config file for suspicious patterns (secrets, tokens)
- Warn if potentially sensitive data detected
- Document security requirements in README

## Dependencies

### External

- PyYAML: YAML parsing and JSON generation (already installed)
- Python 3.9+: Required for type hints and modern features

### Internal

- `fulcrum-power-automate-connector.yaml`: Input from trigger augmenter
- `connector-config.yaml`: User-provided configuration
- `build/` directory: Existing output location

### Optional

- JSON Schema validators: For strict validation against Microsoft schemas
- Icon processing libraries: For future icon support
