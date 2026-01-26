# conversion-pipeline Specification

## Purpose
TBD - created by archiving change add-powerautomate-triggers. Update Purpose after archive.
## Requirements
### Requirement: Webhook Payload Schema Definition

The augmented spec SHALL include a schema definition for Fulcrum webhook payloads.

#### Scenario: Payload schema structure
- **WHEN** the augmented spec is generated
- **THEN** it SHALL contain a `FulcrumWebhookPayload` definition
- **AND** the definition SHALL include `id`, `type`, and `data` properties at minimum
- **AND** each property SHALL have `x-ms-summary` for Power Automate UI
- **AND** the `type` property description SHALL document all supported event types (record.*, form.*, choice_list.*, classification_set.*)
- **AND** the `data` property description SHALL indicate support for multiple resource types

#### Scenario: Payload schema referenced by trigger
- **WHEN** the `x-ms-notification-content` is defined
- **THEN** it SHALL reference the `FulcrumWebhookPayload` schema via `$ref`

### Requirement: User Experience Extensions

The augmented spec SHALL include extensions that improve the Power Automate user experience.

#### Scenario: Trigger summary format
- **WHEN** the webhook trigger is displayed in Power Automate
- **THEN** the summary SHALL follow the pattern "When a [event description]"
- **AND** the summary SHALL be sentence case

#### Scenario: Operation descriptions
- **WHEN** Power Automate displays trigger details
- **THEN** the description SHALL explain what events trigger the flow
- **AND** the description SHALL mention Fulcrum as the event source
- **AND** the description SHALL list all supported resource types (records, forms, choice lists, classification sets)

#### Scenario: Parameter summaries
- **WHEN** the trigger configuration UI is displayed
- **THEN** visible parameters SHALL have `x-ms-summary` with title case labels
- **AND** parameters SHALL have descriptive `description` text

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

The connector configuration SHALL support connection parameters and policy templates sections in addition to existing required fields.

**Modification:** Add support for connection parameters and policy templates sections.

#### Scenario: Configuration file structure with new sections
- **GIVEN** a `connector-config.yaml` file exists at the repository root
- **WHEN** the file is parsed
- **THEN** it SHALL contain required fields: `publisher`, `displayName`, `iconBrandColor`, `supportEmail` (existing)
- **AND** it SHALL contain authentication configuration: `authentication.type`, `authentication.displayName` (existing)
- **AND** it MAY contain `connectionParameters` section (NEW)
- **AND** it MAY contain `policyTemplates` section (NEW)
- **AND** if `connectionParameters` or `policyTemplates` are present, they SHALL be validated

### Requirement: API Properties Generation

The certification packager SHALL extend API properties generation to support additional connection parameters and policy templates beyond authentication.

**Modification:** Extend to support additional connection parameters and policy templates.

#### Scenario: API properties structure with policy templates
- **WHEN** `apiProperties.json` is generated
- **THEN** it SHALL contain `properties.connectionParameters` (existing)
- **AND** it SHALL contain `properties.iconBrandColor` (existing)
- **AND** it SHALL contain `properties.capabilities` (existing)
- **AND** it SHALL contain `properties.policyTemplateInstances` (MODIFIED: now populated from config)
- **AND** each property SHALL conform to Microsoft's schema for certified connectors

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

### Requirement: Connection Parameters Configuration

The connector configuration SHALL support custom connection parameters beyond authentication.

#### Scenario: Connection parameter definition structure
- **WHEN** a `connectionParameters` section is present in `connector-config.yaml`
- **THEN** each parameter SHALL have a `type` field (e.g., "string", "securestring", "int", "bool")
- **AND** each parameter SHALL have a `uiDefinition` object
- **AND** `uiDefinition` SHALL contain `displayName`, `description`, and `tooltip` fields
- **AND** `uiDefinition` MAY contain a `constraints` object with validation rules
- **AND** parameters MAY have a `default` field for default values

#### Scenario: Host URL connection parameter
- **WHEN** configuring dynamic host URL support
- **THEN** `connector-config.yaml` SHALL include a `hostUrl` parameter under `connectionParameters`
- **AND** the `hostUrl` parameter SHALL have `type: "string"`
- **AND** the `hostUrl` parameter SHALL have `default: "api.fulcrumapp.com"`
- **AND** the `hostUrl` parameter SHALL have `uiDefinition.displayName: "Host URL"`
- **AND** the `hostUrl` parameter SHALL have a descriptive tooltip explaining usage
- **AND** the `hostUrl` parameter SHALL have `constraints.required: false`
- **AND** the `hostUrl` parameter MAY include hostname validation pattern in constraints

#### Scenario: Multiple connection parameters
- **WHEN** multiple parameters are defined in `connectionParameters`
- **THEN** all parameters SHALL be merged into `apiProperties.json`
- **AND** authentication parameters SHALL be listed first
- **AND** additional connection parameters SHALL be listed after authentication
- **AND** parameter order SHALL be preserved from configuration

### Requirement: Policy Templates Configuration

The connector configuration SHALL support Microsoft Power Platform policy templates for runtime behavior customization.

#### Scenario: Policy template definition structure
- **WHEN** a `policyTemplates` section is present in `connector-config.yaml`
- **THEN** it SHALL be an array of policy template configurations
- **AND** each template SHALL have a `templateId` field (e.g., "dynamichosturl", "setheader")
- **AND** each template SHALL have a `parameters` object with template-specific parameters
- **AND** each template MAY have a `title` field for display purposes
- **AND** parameter keys SHALL follow Microsoft's naming convention: `x-ms-apimTemplateParameter.*`

#### Scenario: Dynamic host URL policy template
- **WHEN** configuring dynamic host URL support
- **THEN** `connector-config.yaml` SHALL include a policy template with `templateId: "dynamichosturl"`
- **AND** the template SHALL have `parameters.x-ms-apimTemplateParameter.urlTemplate`
- **AND** the `urlTemplate` SHALL be set to `"https://@connectionParameters('hostUrl')"`
- **AND** the template SHALL NOT specify `x-ms-apimTemplate-operationName` (applies to all operations)
- **AND** the template MAY have `title: "Set API Host URL"`

#### Scenario: Policy template expressions
- **WHEN** defining URL template with connection parameter reference
- **THEN** the expression SHALL use format `@connectionParameters('paramName')`
- **AND** the parameter name SHALL match a key in `connectionParameters` section
- **AND** the URL template SHALL include protocol (e.g., `https://`)
- **AND** the URL template SHALL NOT include basePath (handled by swagger spec)

### Requirement: Connection Parameters in API Properties

The certification packager SHALL generate connection parameters in `apiProperties.json` from configuration.

#### Scenario: Merging authentication and connection parameters
- **WHEN** generating `apiProperties.json`
- **AND** `connector-config.yaml` contains both `authentication` and `connectionParameters` sections
- **THEN** `properties.connectionParameters` SHALL include the authentication parameter
- **AND** `properties.connectionParameters` SHALL include all parameters from `connectionParameters` section
- **AND** authentication parameters SHALL appear first in the object
- **AND** additional parameters SHALL appear after authentication parameters

#### Scenario: Connection parameter format in apiProperties.json
- **WHEN** a connection parameter is added to `apiProperties.json`
- **THEN** it SHALL have the structure: `{ "type": "...", "uiDefinition": {...} }`
- **AND** the `type` field SHALL be copied from configuration
- **AND** the `uiDefinition` object SHALL be copied from configuration
- **AND** if a `default` value is specified in config, it SHALL be added to `uiDefinition.constraints.default`
- **AND** existing constraints SHALL be preserved when adding default value

#### Scenario: Host URL parameter in apiProperties.json
- **WHEN** `apiProperties.json` is generated with `hostUrl` connection parameter
- **THEN** `properties.connectionParameters.hostUrl` SHALL exist
- **AND** it SHALL have `type: "string"`
- **AND** it SHALL have `uiDefinition.displayName: "Host URL"`
- **AND** it SHALL have `uiDefinition.description` explaining the parameter purpose
- **AND** it SHALL have `uiDefinition.tooltip` with regional endpoints examples (US, Canada, Australia, Europe)
- **AND** it SHALL have `uiDefinition.constraints.default: "api.fulcrumapp.com"`
- **AND** it SHALL have `uiDefinition.constraints.required: false`

### Requirement: Policy Template Instances in API Properties

The certification packager SHALL generate policy template instances in `apiProperties.json` from configuration.

#### Scenario: Policy template instances array generation
- **WHEN** generating `apiProperties.json`
- **AND** `connector-config.yaml` contains a `policyTemplates` section
- **THEN** `properties.policyTemplateInstances` SHALL be an array
- **AND** the array SHALL contain one element per template in configuration
- **AND** each element SHALL have `templateId`, `title`, and `parameters` fields
- **AND** the `templateId` SHALL match the config `templateId`
- **AND** the `parameters` object SHALL be copied from config without modification

#### Scenario: Empty policy templates
- **WHEN** generating `apiProperties.json`
- **AND** `connector-config.yaml` does NOT contain a `policyTemplates` section
- **THEN** `properties.policyTemplateInstances` SHALL be an empty array `[]`

#### Scenario: Dynamic host URL policy instance
- **WHEN** `apiProperties.json` is generated with `dynamichosturl` policy template
- **THEN** `properties.policyTemplateInstances` SHALL contain one object
- **AND** the object SHALL have `templateId: "dynamichosturl"`
- **AND** the object SHALL have `title: "Set API Host URL"` (or configured title)
- **AND** the object SHALL have `parameters.x-ms-apimTemplateParameter.urlTemplate`
- **AND** the `urlTemplate` value SHALL be `"https://@connectionParameters('hostUrl')"`

### Requirement: Configuration Validation for Connection Parameters

The certification packager SHALL validate connection parameter configuration before generating output files.

#### Scenario: Required fields validation
- **WHEN** `validate_config()` is called
- **AND** `connector-config.yaml` contains a `connectionParameters` section
- **THEN** validation SHALL check each parameter has a `type` field
- **AND** validation SHALL check each parameter has a `uiDefinition` field
- **AND** validation SHALL exit with error if `type` is missing
- **AND** validation SHALL exit with error if `uiDefinition` is missing
- **AND** error messages SHALL indicate which parameter is invalid

#### Scenario: Optional fields validation
- **WHEN** validating connection parameters
- **THEN** validation SHALL NOT require `default` field
- **AND** validation SHALL NOT require `constraints` field
- **AND** validation SHALL allow any valid JSON type for `type` field

#### Scenario: Validation error messages for connection parameters
- **WHEN** a connection parameter validation fails
- **THEN** the error message SHALL include the parameter name
- **AND** the error message SHALL indicate which field is missing
- **AND** the message format SHALL be: `ERROR: Connection parameter '{name}' missing '{field}'`
- **AND** the process SHALL exit with status code 1

### Requirement: Configuration Validation for Policy Templates

The certification packager SHALL validate policy template configuration before generating output files.

#### Scenario: Required policy template fields validation
- **WHEN** `validate_config()` is called
- **AND** `connector-config.yaml` contains a `policyTemplates` section
- **THEN** validation SHALL check each template has a `templateId` field
- **AND** validation SHALL check each template has a `parameters` field
- **AND** validation SHALL exit with error if `templateId` is missing
- **AND** validation SHALL exit with error if `parameters` is missing
- **AND** error messages SHALL clearly indicate the validation failure

#### Scenario: Policy template array validation
- **WHEN** validating policy templates
- **THEN** validation SHALL verify `policyTemplates` is an array
- **AND** validation SHALL process each element in the array
- **AND** validation SHALL continue checking all templates even if one fails
- **AND** validation SHALL exit with non-zero status if any template is invalid

#### Scenario: Validation error messages for policy templates
- **WHEN** a policy template validation fails
- **THEN** the error message SHALL indicate which template is invalid
- **AND** the error message SHALL indicate which field is missing
- **AND** the message format SHALL be: `ERROR: Policy template missing '{field}'`
- **AND** the process SHALL exit with status code 1

### Requirement: README Documentation for Custom Host URLs

The README generation SHALL include documentation for configuring custom host URLs.

#### Scenario: Custom host URL section in README
- **WHEN** `README.md` is generated
- **AND** `connector-config.yaml` includes a `hostUrl` connection parameter
- **THEN** the "Getting Started" section SHALL include guidance on custom host URLs
- **AND** the guidance SHALL explain the default host URL (`api.fulcrumapp.com`)
- **AND** the guidance SHALL explain when to use regional or custom host URLs
- **AND** the guidance SHALL provide examples for all regional endpoints
- **AND** the guidance SHALL document the URL format requirements

#### Scenario: Custom host URL examples
- **WHEN** documenting custom host URLs in README
- **THEN** examples SHALL include all Fulcrum regional endpoints
- **AND** examples SHALL include United States (default): `api.fulcrumapp.com`
- **AND** examples SHALL include Canada: `api.fulcrumapp-ca.com`
- **AND** examples SHALL include Australia: `api.fulcrumapp-au.com`
- **AND** examples SHALL include Europe: `api.fulcrumapp-eu.com`
- **AND** examples MAY include custom domain example: `api.your-company.com`
- **AND** examples SHALL clarify users should enter hostname only (no protocol or path)

#### Scenario: Custom host URL troubleshooting
- **WHEN** documenting custom host URLs in README
- **THEN** a troubleshooting subsection SHALL be included
- **AND** troubleshooting SHALL mention verifying host accessibility
- **AND** troubleshooting SHALL mention checking for typos in hostname
- **AND** troubleshooting SHALL mention validating API token for the specified host

### Requirement: Validation Script Updates for Connection Parameters and Policy Templates

The validation script SHALL verify that connection parameters and policy templates are correctly generated in certification package.

#### Scenario: Connection parameter presence validation
- **WHEN** the validation script runs
- **THEN** it SHALL parse `apiProperties.json`
- **AND** it SHALL check if `properties.connectionParameters.hostUrl` exists
- **AND** it SHALL verify the `hostUrl` parameter has required fields: `type`, `uiDefinition`
- **AND** it SHALL verify the `uiDefinition` has required fields: `displayName`, `description`, `tooltip`
- **AND** it SHALL report error if any required field is missing

#### Scenario: Policy template instance presence validation
- **WHEN** the validation script runs
- **THEN** it SHALL parse `apiProperties.json`
- **AND** it SHALL check if `properties.policyTemplateInstances` exists and is an array
- **AND** if connection parameters include `hostUrl`, it SHALL verify a `dynamichosturl` template exists
- **AND** it SHALL verify the template has required fields: `templateId`, `parameters`
- **AND** it SHALL verify `parameters.x-ms-apimTemplateParameter.urlTemplate` exists
- **AND** it SHALL report error if policy template structure is invalid

#### Scenario: URL template expression validation
- **WHEN** validating the `dynamichosturl` policy template
- **THEN** the validation script SHALL check the `urlTemplate` value
- **AND** it SHALL verify the template contains `@connectionParameters('hostUrl')`
- **AND** it SHALL verify the template starts with `https://`
- **AND** it SHALL warn if template includes basePath (should be in swagger spec, not URL template)
- **AND** it SHALL report error if URL template format is invalid

### Requirement: Configurable API Version

The certification packager SHALL support configurable API version numbers to allow independent versioning of the Power Automate connector from the underlying API specification.

#### Scenario: Version override from configuration
- **GIVEN** a `connector-config.yaml` file contains a `version` field with value "1.0.5"
- **AND** the source Swagger spec has `info.version` of "2"
- **WHEN** the certification packager generates `apiDefinition.swagger.json`
- **THEN** the output SHALL have `info.version` set to "1.0.5"
- **AND** the source spec version SHALL be overridden

#### Scenario: Version field validation
- **WHEN** `connector-config.yaml` is validated
- **THEN** the `version` field SHALL be required
- **AND** SHALL be a string
- **AND** validation SHALL fail if `version` is missing

#### Scenario: Missing version field rejected
- **GIVEN** a `connector-config.yaml` file does NOT contain a `version` field
- **WHEN** the certification packager validates the configuration
- **THEN** validation SHALL fail with an error message
- **AND** the error SHALL indicate that the `version` field is required

### Requirement: Version Configuration Documentation

The README SHALL document how to configure the connector version independently from the API specification version.

#### Scenario: README explains version configuration
- **WHEN** a user reads the "Customizing Connector Metadata" section in README.md
- **THEN** the documentation SHALL explain the `version` field in `connector-config.yaml`
- **AND** SHALL provide an example of setting a version value
- **AND** SHALL explain the purpose of versioning the connector
- **AND** SHALL note that version is required

#### Scenario: Version configuration example in README
- **WHEN** the README shows connector-config.yaml example
- **THEN** it SHALL include the `version` field as a required parameter
- **AND** SHALL show the format clearly (e.g., `version: "1.0.0"`)

