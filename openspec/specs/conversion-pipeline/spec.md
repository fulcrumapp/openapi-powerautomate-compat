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

