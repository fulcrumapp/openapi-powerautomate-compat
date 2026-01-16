# conversion-pipeline Specification Delta

## ADDED Requirements

### Requirement: Certification Package Generation

The conversion pipeline SHALL generate a complete Microsoft Power Platform certification package ready for submission to the PowerPlatformConnectors repository.

#### Scenario: Three required files generated
- **GIVEN** the trigger-augmented Swagger spec exists at `build/fulcrum-power-automate-connector.yaml`
- **AND** a valid `connector-config.yaml` exists at the repository root
- **WHEN** the certification packager runs
- **THEN** it SHALL generate three files in `build/certified-connectors/Fulcrum/`:
  - `apiDefinition.swagger.json` (JSON format)
  - `apiProperties.json` (connector metadata)
  - `README.md` (documentation)

#### Scenario: Files contain required content
- **WHEN** the certification package is generated
- **THEN** `apiDefinition.swagger.json` SHALL be valid JSON (not YAML)
- **AND** `apiDefinition.swagger.json` SHALL contain all paths, operations, and schemas from the input spec
- **AND** `apiProperties.json` SHALL contain `properties.connectionParameters` for API key authentication
- **AND** `apiProperties.json` SHALL contain `properties.iconBrandColor` set to "#EB1300"
- **AND** `README.md` SHALL contain sections: "Prerequisites", "Obtaining Credentials", "Supported Operations"

#### Scenario: Operations list auto-generated
- **WHEN** `README.md` is generated
- **THEN** the "Supported Operations" section SHALL list all operations from the spec
- **AND** each operation SHALL include its HTTP method, path, and summary/description
- **AND** operations SHALL be organized in a readable format (table or list)

### Requirement: Connector Metadata Configuration

The pipeline SHALL use a centralized configuration file for connector metadata that applies across all certification artifacts.

#### Scenario: Configuration file structure
- **GIVEN** a `connector-config.yaml` file exists at the repository root
- **WHEN** the file is parsed
- **THEN** it SHALL contain required fields: `publisher`, `displayName`, `iconBrandColor`, `supportEmail`
- **AND** it SHALL contain authentication configuration: `authentication.type`, `authentication.displayName`
- **AND** it SHALL contain `prerequisites` array with subscription and API access requirements

#### Scenario: Configuration propagates to all files
- **WHEN** certification files are generated
- **THEN** `apiProperties.json` SHALL use `iconBrandColor` from config
- **AND** `apiProperties.json` SHALL use `authentication` settings from config for connection parameters
- **AND** `README.md` SHALL use `publisher` and `supportEmail` from config
- **AND** `README.md` SHALL use `prerequisites` array from config in the Prerequisites section

#### Scenario: Configuration validation
- **WHEN** the certification packager runs
- **THEN** it SHALL validate that `connector-config.yaml` exists
- **AND** it SHALL validate that the file is valid YAML syntax
- **AND** it SHALL validate that required fields are present and non-empty
- **AND** it SHALL exit with an error if configuration is invalid
- **AND** it SHALL provide clear error messages indicating missing fields

### Requirement: API Properties Generation

The certification packager SHALL generate a valid `apiProperties.json` file conforming to Microsoft's schema for certified connectors.

#### Scenario: API key authentication configuration
- **WHEN** `apiProperties.json` is generated with authentication type "apiKey"
- **THEN** `properties.connectionParameters` SHALL contain an API key parameter
- **AND** the API key parameter SHALL have `type: "securestring"`
- **AND** the API key parameter SHALL have `uiDefinition.displayName` from config
- **AND** the API key parameter SHALL have `uiDefinition.description` explaining where to get the token
- **AND** the API key parameter SHALL have `uiDefinition.tooltip` with the token URL
- **AND** `uiDefinition.constraints.required` SHALL be set to `"true"`

#### Scenario: Branding configuration
- **WHEN** `apiProperties.json` is generated
- **THEN** `properties.iconBrandColor` SHALL be set to the value from config (e.g., "#EB1300")
- **AND** the color SHALL be in hex format: `#` followed by 6 hexadecimal digits

#### Scenario: Capabilities configuration
- **WHEN** `apiProperties.json` is generated for cloud-only connector
- **THEN** `properties.capabilities` SHALL be an empty array
- **AND** `properties.policyTemplateInstances` SHALL be an empty array if no policies are defined

### Requirement: README Documentation Generation

The certification packager SHALL generate a comprehensive README.md file following Microsoft's certified connector template structure (https://github.com/microsoft/PowerPlatformConnectors/blob/dev/templates/certified-connectors/readme.md).

#### Scenario: Required sections present per Microsoft template
- **WHEN** `README.md` is generated
- **THEN** it SHALL include a title "# Fulcrum" with connector description
- **AND** it SHALL include a "## Publisher: {publisher name}" section
- **AND** it SHALL include a "## Prerequisites" section listing subscription and API access requirements
- **AND** it SHALL include a "## Supported Operations" section with operation descriptions
- **AND** it SHALL include an "## Obtaining Credentials" section with API token instructions
- **AND** it SHALL include a "## Getting Started" section (optional, from config)
- **AND** it SHALL include a "## Known Issues and Limitations" section
- **AND** it SHALL include a "## Frequently Asked Questions" section (optional, from config)
- **AND** it SHALL include a "## Deployment Instructions" section

#### Scenario: Prerequisites content
- **WHEN** the "Prerequisites" section is generated
- **THEN** it SHALL list "Active Fulcrum subscription with API access enabled"

#### Scenario: Obtaining Credentials content
- **WHEN** the "Obtaining Credentials" section is generated
- **THEN** it SHALL be populated from the `authentication` section in `connector-config.yaml`
- **AND** it SHALL explain the authentication method (e.g., API key)
- **AND** it SHALL provide the URL where users can get their credentials (e.g., `https://web.fulcrumapp.com/settings/api`)
- **AND** it SHALL NOT duplicate connection setup instructions that belong in Getting Started

#### Scenario: Supported Operations content accuracy
- **WHEN** the "Supported Operations" section is generated
- **THEN** it SHALL parse all paths from the Swagger spec
- **AND** it SHALL list each operation with its `operationId` or summary
- **AND** it SHALL include the HTTP method (GET, POST, PUT, DELETE, PATCH) for each operation
- **AND** operations SHALL be organized logically (e.g., grouped by resource type or alphabetically)

#### Scenario: Optional sections from configuration
- **WHEN** `connector-config.yaml` contains optional `gettingStarted` field
- **THEN** the README SHALL include a "## Getting Started" section with that content
- **WHEN** `connector-config.yaml` contains optional `faqs` array
- **THEN** the README SHALL include a "## Frequently Asked Questions" section with question/answer pairs
- **WHEN** `connector-config.yaml` contains optional `deploymentInstructions` field
- **THEN** the README SHALL include a "## Deployment Instructions" section with that content

### Requirement: Pipeline Integration

The certification packaging step SHALL be integrated into the existing conversion pipeline with proper error handling and reporting.

#### Scenario: Packaging step in pipeline sequence
- **WHEN** the conversion pipeline runs via `convert_openapi.sh`
- **THEN** the certification packager SHALL be called after trigger augmentation completes
- **AND** the packager SHALL receive the path to `fulcrum-power-automate-connector.yaml`
- **AND** the packager SHALL receive the path to `connector-config.yaml`

#### Scenario: Packaging success reporting
- **WHEN** the certification packager completes successfully
- **THEN** the pipeline SHALL log a success message
- **AND** the message SHALL indicate the output location: `build/certified-connectors/Fulcrum/`
- **AND** the message SHALL list the three generated files

#### Scenario: Packaging error handling
- **WHEN** the certification packager encounters an error
- **THEN** it SHALL log a clear error message indicating the failure reason
- **AND** it SHALL exit with a non-zero status code
- **AND** the pipeline SHALL stop execution (due to `set -e`)
- **AND** partial/incomplete files SHALL NOT be created

### Requirement: Certification Package Validation

The validation script SHALL verify that the certification package is complete, valid, and ready for submission to Microsoft.

#### Scenario: File existence validation
- **WHEN** the validation script runs
- **THEN** it SHALL check that `build/certified-connectors/Fulcrum/apiDefinition.swagger.json` exists
- **AND** it SHALL check that `build/certified-connectors/Fulcrum/apiProperties.json` exists
- **AND** it SHALL check that `build/certified-connectors/Fulcrum/README.md` exists
- **AND** it SHALL report an error if any file is missing

#### Scenario: JSON format validation
- **WHEN** validating the certification package
- **THEN** `apiDefinition.swagger.json` SHALL be parseable as valid JSON
- **AND** `apiProperties.json` SHALL be parseable as valid JSON
- **AND** validation SHALL fail if either file contains YAML syntax or is malformed

#### Scenario: Required fields validation
- **WHEN** validating `apiProperties.json`
- **THEN** it SHALL verify that `properties.connectionParameters` exists
- **AND** it SHALL verify that `properties.iconBrandColor` exists and matches pattern `#[0-9A-Fa-f]{6}`
- **AND** it SHALL verify that connection parameters contain authentication configuration

#### Scenario: README sections validation per Microsoft template
- **WHEN** validating `README.md`
- **THEN** it SHALL verify that the file contains "# Fulcrum" as the title
- **AND** it SHALL verify that the file contains a "## Publisher:" section
- **AND** it SHALL verify that the file contains a "## Prerequisites" section
- **AND** it SHALL verify that the file contains a "## Supported Operations" section
- **AND** it SHALL verify that the file contains an "## Obtaining Credentials" section
- **AND** it SHALL verify that the file contains a "## Known Issues and Limitations" section
- **AND** it SHALL verify that the file contains a "## Deployment Instructions" section
- **AND** validation SHALL fail if required sections are missing

#### Scenario: File size validation
- **WHEN** validating the certification package
- **THEN** each file SHALL have a reasonable file size (not empty, not truncated)
- **AND** `apiDefinition.swagger.json` SHALL be at least 5KB
- **AND** `README.md` SHALL be at least 500 bytes
- **AND** validation SHALL warn if files are unexpectedly small

#### Scenario: Validation success reporting
- **WHEN** all certification package validations pass
- **THEN** the validation script SHALL print a success message
- **AND** the message SHALL confirm "Certification package is ready for submission"
- **AND** the message SHALL include the location of the package

### Requirement: Build Artifact Management

Generated certification artifacts SHALL be properly managed in the build system to avoid accidental commits and ensure clean builds.

#### Scenario: Gitignore configuration
- **WHEN** certification files are generated
- **THEN** the output directory `build/certified-connectors/` SHALL be listed in `.gitignore`
- **AND** Git SHALL not track any files in `build/certified-connectors/`

#### Scenario: Clean output directory
- **WHEN** the certification packager runs
- **THEN** it SHALL create the output directory if it doesn't exist
- **AND** it SHALL overwrite existing files in the output directory
- **AND** old/stale files SHALL be replaced with fresh generated files

## ADDED Requirements (continued)

### Requirement: Pipeline Output Documentation

The conversion pipeline documentation SHALL include information about certification package output.

#### Scenario: Updated pipeline completion message
- **WHEN** the conversion pipeline completes successfully
- **THEN** the completion message SHALL list `apiDefinition.swagger.json`, `apiProperties.json`, and `README.md`
- **AND** the message SHALL indicate their location in `build/certified-connectors/Fulcrum/`
- **AND** the message SHALL mention they are ready for Microsoft certification submission

#### Scenario: AGENTS.md validation workflow updated
- **WHEN** the AGENTS.md file documents the validation workflow
- **THEN** it SHALL include certification package validation as a step
- **AND** it SHALL document expected certification file locations
- **AND** it SHALL list certification-specific validation checks

#### Scenario: README.md usage instructions updated
- **WHEN** the project README.md explains usage
- **THEN** it SHALL document the certification package output
- **AND** it SHALL explain the purpose of `connector-config.yaml`
- **AND** it SHALL provide instructions for customizing connector metadata
