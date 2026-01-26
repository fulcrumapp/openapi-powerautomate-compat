# Implementation Tasks

## 1. Implementation

- [x] Add `version` field to `connector-config.yaml` schema validation in `certification_packager.py`
- [x] Update `generate_api_definition()` to check for `version` in config and override `info.version` when present
- [x] Add `version` field to `connector-config.yaml` with clear comment explaining its purpose
- [x] Update README.md "Customizing Connector Metadata" section to document version configuration

## 2. Validation

- [x] Run `./scripts/validate.sh` to ensure certification package is still generated correctly
- [x] Verify that when `version` is set in `connector-config.yaml`, it appears in `apiDefinition.swagger.json`
- [x] Verify that validation fails with clear error when `version` is missing from config
- [x] Check that README.md clearly explains that version is required

## 3. Documentation

- [x] Ensure README.md explains that version is required
- [x] Include example of version configuration in README.md
