# Change: Add Microsoft Certification Packaging

## Why

Microsoft Power Platform requires three specific files for certified connector submission:
1. `apiDefinition.swagger.json` - The OpenAPI/Swagger specification
2. `apiProperties.json` - Connector metadata, branding, and authentication configuration
3. `README.md` - Documentation with prerequisites, setup instructions, and operations list

Currently, the conversion pipeline outputs `fulcrum-power-automate-connector.yaml` but doesn't package it for Microsoft certification. Manual file creation is error-prone and time-consuming. Automating this packaging step ensures:
- Consistent metadata across submissions
- Reduced manual work when updating the connector
- Validation that all required files meet Microsoft's schema requirements
- Proper structure matching Microsoft's PowerPlatformConnectors repository format

As a verified publisher submitting a certified connector, the submission must include properly formatted files with correct branding (Fulcrum brand color #EB1300), authentication configuration (API key), and comprehensive documentation.

## What Changes

- Add a new pipeline step (`certification_packager.py`) that generates Microsoft certification files from the cleaned Swagger spec
- Create a configuration file (`connector-config.yaml`) to store reusable connector metadata (publisher, branding, authentication, support contact, README content)
- Modify `convert_openapi.sh` to call the certification packager after trigger augmentation
- Generate three output files in `build/certified-connectors/Fulcrum/`:
  - `apiDefinition.swagger.json` (converted from YAML)
  - `apiProperties.json` (generated from config + spec analysis)
  - `README.md` (generated following Microsoft's template structure: https://github.com/microsoft/PowerPlatformConnectors/blob/dev/templates/certified-connectors/readme.md with "Fulcrum" as title)
- Update `validate.sh` to verify certification package completeness, schema compliance, and README template conformance
- Update `.gitignore` to exclude `build/certified-connectors/` directory

## Impact

- Affected specs: `conversion-pipeline`
- Affected code:
  - `scripts/convert_openapi.sh` - Add call to certification packager
  - `scripts/certification_packager.py` - New file for generating certification artifacts
  - `scripts/validate.sh` - Add validation for certification package
  - `connector-config.yaml` - New configuration file (root directory)
  - `.gitignore` - Add certification output directory
- Output: The pipeline will produce a complete, submission-ready certification package in `build/certified-connectors/Fulcrum/` containing all three required files with proper branding, authentication configuration, and documentation
- Users: Fulcrum developers submitting connector updates to Microsoft will have automated, validated certification packages ready for pull request submission to microsoft/PowerPlatformConnectors repository
