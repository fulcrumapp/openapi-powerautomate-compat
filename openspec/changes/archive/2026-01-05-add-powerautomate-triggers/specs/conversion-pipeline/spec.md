# Conversion Pipeline Specification

## ADDED Requirements

### Requirement: Power Automate Trigger Augmentation

The pipeline SHALL augment the cleaned Swagger 2.0 specification with Microsoft Power Automate trigger extensions to enable webhook-based triggers.

#### Scenario: Webhook endpoint marked as trigger
- **WHEN** the trigger augmenter processes a spec containing `POST /v2/webhooks.json`
- **THEN** the endpoint SHALL have `x-ms-trigger: single` extension added
- **AND** the endpoint SHALL have a user-friendly summary starting with "When"

#### Scenario: Callback URL parameter configured
- **WHEN** the trigger augmenter processes the webhook registration endpoint
- **THEN** the callback URL parameter SHALL have `x-ms-notification-url: true`
- **AND** the parameter SHALL have `x-ms-visibility: internal` to hide from users

#### Scenario: Webhook payload schema defined
- **WHEN** the trigger augmenter completes processing
- **THEN** the spec SHALL include `x-ms-notification-content` at the path level
- **AND** the notification content SHALL reference a webhook payload schema
- **AND** the payload schema properties SHALL have `x-ms-summary` for UI display

#### Scenario: Trigger hint provided
- **WHEN** the trigger augmenter processes the webhook endpoint
- **THEN** the endpoint SHALL have `x-ms-trigger-hint` with guidance for users

### Requirement: Trigger Augmentation Pipeline Step

The conversion pipeline SHALL include trigger augmentation as a distinct processing step.

#### Scenario: Pipeline execution order
- **WHEN** the conversion pipeline executes
- **THEN** trigger augmentation SHALL run after spec cleaning
- **AND** trigger augmentation SHALL run before validation

#### Scenario: Augmentation script execution
- **WHEN** `convert_openapi.sh` runs the trigger augmenter
- **THEN** the script SHALL process `swagger-2.0-cleaned.yaml`
- **AND** the script SHALL output the augmented spec to the same file (in-place update)
- **AND** the script SHALL report success or failure with appropriate exit codes

#### Scenario: Missing webhook endpoint handling
- **WHEN** the trigger augmenter processes a spec without webhook endpoints
- **THEN** the augmenter SHALL complete without error
- **AND** the augmenter SHALL log a warning that no triggers were configured

### Requirement: Webhook Delete Endpoint for Trigger Lifecycle

The pipeline SHALL preserve the webhook DELETE endpoint required for Power Automate trigger lifecycle management.

#### Scenario: Delete endpoint included in cleaned spec
- **WHEN** the spec cleaner filters endpoints
- **THEN** `DELETE /v2/webhooks/{webhook_id}.json` SHALL be preserved
- **AND** the endpoint SHALL have a valid `operationId`
- **AND** the endpoint SHALL have `x-ms-visibility: internal` to mark it as an internal action

#### Scenario: Delete endpoint for trigger cleanup
- **WHEN** a Power Automate flow using the trigger is deleted or modified
- **THEN** Power Automate SHALL be able to call the DELETE endpoint
- **AND** the webhook registration SHALL be removed from Fulcrum

### Requirement: Location Header for Webhook Management

The webhook POST endpoint SHALL include a Location header in success responses to enable Power Automate to manage and delete webhook subscriptions.

#### Scenario: Location header in webhook creation response
- **WHEN** the trigger augmenter processes the webhook POST endpoint
- **THEN** the 201 response SHALL include a `Location` header definition
- **AND** the header SHALL have `type: string`
- **AND** the header SHALL have a description indicating it contains the webhook management URL
- **AND** the header SHALL have `x-ms-summary` for Power Automate UI

#### Scenario: Location header enables trigger lifecycle
- **WHEN** Power Automate creates a webhook subscription
- **THEN** it SHALL receive a Location header with the webhook deletion URL (e.g., `/v2/webhooks/{webhook_id}.json`)
- **AND** Power Automate SHALL use this URL to delete the webhook when the flow is removed or modified
- **AND** this enables proper cleanup of webhook subscriptions

**Reference:** [Microsoft Documentation - Create a webhook trigger](https://learn.microsoft.com/en-us/connectors/custom-connectors/create-webhook-trigger)

### Requirement: Trigger Validation

The validation pipeline SHALL verify that Power Automate trigger extensions are correctly configured.

#### Scenario: Trigger extension validation
- **WHEN** `validate.sh` checks the augmented spec
- **THEN** it SHALL verify `x-ms-trigger` is present on webhook POST endpoint
- **AND** it SHALL verify `x-ms-notification-url` is present on a parameter
- **AND** it SHALL verify `x-ms-notification-content` schema is defined

#### Scenario: Validation failure reporting
- **WHEN** required trigger extensions are missing
- **THEN** validation SHALL fail with a descriptive error message
- **AND** the error message SHALL identify which extension is missing

## ADDED Requirements

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
