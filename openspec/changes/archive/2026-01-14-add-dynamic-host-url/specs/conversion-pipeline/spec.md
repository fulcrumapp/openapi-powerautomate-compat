# conversion-pipeline Specification (Delta)

This delta modifies the conversion-pipeline capability to add dynamic host URL configuration support.

## ADDED Requirements

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

## MODIFIED Requirements

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

## Implementation Notes

### Code Changes Summary

**Files Modified:**
1. `connector-config.yaml` - Add `connectionParameters` and `policyTemplates` sections
2. `scripts/certification_packager.py` - Extend `generate_api_properties()` and `validate_config()`
3. `scripts/validate.sh` - Add checks for connection parameters and policy templates

**Files Created:**
None (all changes are modifications to existing files)

### Backward Compatibility

- `connectionParameters` and `policyTemplates` sections are OPTIONAL in `connector-config.yaml`
- If sections are absent, packager behaves as before (generates empty `policyTemplateInstances` array)
- Authentication parameter generation is unchanged
- No breaking changes to existing configuration or output format

### Dependencies

- No new external dependencies
- Uses existing YAML parsing (PyYAML)
- Uses existing JSON generation (json module)
- No new Python packages required

### Testing Approach

**Configuration Testing:**
- Test config with connectionParameters and policyTemplates parses correctly
- Test config without new sections works (backward compatibility)
- Test invalid configurations trigger validation errors

**Generation Testing:**
- Test apiProperties.json contains hostUrl parameter
- Test apiProperties.json contains dynamichosturl policy instance
- Test parameter merging (auth + connection parameters)
- Test policy template array generation

**Validation Testing:**
- Test validation script detects missing connection parameter fields
- Test validation script detects missing policy template fields
- Test validation script verifies URL template format

### Error Scenarios

**Configuration Errors:**
- Missing `type` in connection parameter → Clear error message with parameter name
- Missing `uiDefinition` in connection parameter → Clear error message with parameter name
- Missing `templateId` in policy template → Clear error message
- Missing `parameters` in policy template → Clear error message

**Runtime Errors (Power Platform):**
- Invalid hostname entered by user → Power Platform shows connection error
- Hostname doesn't resolve → API call fails with network error
- Invalid Fulcrum API endpoint → API returns 404 or authentication error

### Validation Checklist

- [ ] `connector-config.yaml` parses as valid YAML
- [ ] `connectionParameters.hostUrl` has all required fields
- [ ] `policyTemplates[0]` has `templateId: "dynamichosturl"`
- [ ] Generated `apiProperties.json` is valid JSON
- [ ] `apiProperties.json` contains `hostUrl` in connection parameters
- [ ] `apiProperties.json` contains `dynamichosturl` in policy template instances
- [ ] URL template expression is correct: `https://@connectionParameters('hostUrl')`
- [ ] README.md includes custom host URL documentation
- [ ] `./scripts/validate.sh` passes with new checks
- [ ] No regressions in existing functionality
