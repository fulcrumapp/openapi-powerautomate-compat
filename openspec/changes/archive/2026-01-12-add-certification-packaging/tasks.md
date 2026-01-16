# Implementation Tasks

## Phase 1: Configuration and Core Packaging Script

- [x] Create `connector-config.yaml` at repository root with Fulcrum-specific metadata
  - Publisher: "Fulcrum"
  - Display name: "Fulcrum"
  - Description: Multi-line description for README title section
  - Brand color: "#EB1300"
  - Category: "Field Productivity"
  - Support email: "support@fulcrumapp.com"
  - Authentication type: "apiKey"
  - API token field configuration (display name, description, tooltip)
  - Prerequisites array (for README Prerequisites section)
  - Known limitations array (for README Known Issues and Limitations section)
  - Optional: Getting started text (for README Getting Started section)

- [x] Create `scripts/certification_packager.py` with core functionality
  - Parse `connector-config.yaml` for metadata
  - Read input Swagger YAML spec (`fulcrum-power-automate-connector.yaml`)
  - Create output directory structure: `build/certified-connectors/Fulcrum/`
  - Implement YAML to JSON conversion for `apiDefinition.swagger.json`

## Phase 2: API Properties Generation

- [x] Implement `apiProperties.json` generation in `certification_packager.py`
  - Generate `properties.connectionParameters` for API key authentication
  - Set `iconBrandColor` from config
  - Set `capabilities` array (empty for cloud-only)
  - Include `policyTemplateInstances` array (empty if no policies needed)
  - Validate against Microsoft's apiProperties.json schema structure

## Phase 3: README Generation

- [x] Implement `README.md` generation in `certification_packager.py`
  - Follow Microsoft's certified connector template: https://github.com/microsoft/PowerPlatformConnectors/blob/dev/templates/certified-connectors/readme.md
  - Use "Fulcrum" as the title (# Fulcrum)
  - Include connector description from config's `description` field
  - Add "Publisher: {publisher}" section (e.g., "Publisher: Fulcrum")
  - Add "Prerequisites" section from config's `prerequisites` array
  - Add "Supported Operations" section by parsing spec paths/operations
  - Add "Obtaining Credentials" section from config's `authentication` settings
  - Add "Getting Started" section from config's optional `gettingStarted` field
  - Add "Known Issues and Limitations" section from config's `knownLimitations` array

## Phase 4: Pipeline Integration

- [x] Update `scripts/convert_openapi.sh` to call certification packager
  - Add call to `certification_packager.py` after `trigger_augmenter.py`
  - Pass appropriate file paths and error handling
  - Update completion message to mention certification package location

- [x] Update `.gitignore` to exclude certification output
  - Add `build/certified-connectors/` to ignore list (already covered by `build/`)

## Phase 5: Validation

- [x] Update `scripts/validate.sh` to validate certification package
  - Check that all three files exist in expected location
  - Verify `apiDefinition.swagger.json` is valid JSON (not YAML)
  - Verify `apiProperties.json` has required fields: `properties.connectionParameters`, `properties.iconBrandColor`
  - Verify `README.md` has required sections per Microsoft template:
    - Title: "# Fulcrum"
    - "## Publisher: {name}"
    - "## Prerequisites"
    - "## Supported Operations"
    - "## Obtaining Credentials"
    - "## Known Issues and Limitations"
  - Check file sizes are reasonable
  - Report certification package validation results

## Phase 6: Documentation

- [x] Update `AGENTS.md` with certification packaging workflow
  - Document new validation steps for certification package
  - Add certification package to expected output files list
  - Document `connector-config.yaml` purpose and structure

- [x] Update `README.md` with certification packaging information
  - Document the certification package output location
  - Explain how to customize connector metadata via `connector-config.yaml`
  - Add example of certification package structure

## Phase 7: Testing

- [x] Test complete pipeline with certification packaging
  - Run full workflow: download → convert → clean → augment → package
  - Verify all three certification files are generated correctly
  - Validate JSON structure matches Microsoft's examples
  - Verify README markdown formatting and completeness
  - Confirm operations list matches spec endpoints
  - Test validation script catches missing/invalid certification files

- [x] Test configuration customization
  - Modify `connector-config.yaml` values
  - Verify changes propagate to generated files correctly

## Dependencies and Parallelization

**Sequential dependencies:**
- Phase 1 must complete before Phase 2, 3
- Phase 2, 3 can be implemented in parallel (both depend on Phase 1)
- Phase 4 depends on Phase 1, 2, 3 completion
- Phase 5 depends on Phase 4
- Phase 6, 7 can start after Phase 4 completes

**User-visible progress:**
- After Phase 1: Configuration file exists
- After Phase 2-3: Manual execution of packager produces certification files
- After Phase 4: Automated pipeline produces certification package
- After Phase 5: Validation confirms package quality
- After Phase 6: Documentation updated
- After Phase 7: Complete, tested feature
