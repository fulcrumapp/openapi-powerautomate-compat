# conversion-pipeline Specification Deltas

## ADDED Requirements

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
