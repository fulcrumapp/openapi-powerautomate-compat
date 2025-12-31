# Tasks: Add Power Automate Trigger Support

## 1. Implementation

- [ ] 1.1 Create `scripts/trigger_augmenter.py` with core augmentation logic
  - [ ] 1.1.1 Add `x-ms-trigger: single` to webhook POST endpoint
  - [ ] 1.1.2 Add `x-ms-notification-url: true` to callback URL parameter
  - [ ] 1.1.3 Add `x-ms-notification-content` with webhook payload schema
  - [ ] 1.1.4 Add `x-ms-summary` and `x-ms-visibility` extensions
  - [ ] 1.1.5 Add `x-ms-trigger-hint` for user guidance
- [ ] 1.2 Update `scripts/convert_openapi.sh` to call trigger augmenter
- [ ] 1.3 Update `scripts/validate.sh` to verify trigger extensions
- [ ] 1.4 Update `scripts/swagger_cleaner.py` to preserve `x-ms-*` extensions if present

## 2. Webhook Delete Endpoint

- [ ] 2.1 Ensure webhook DELETE endpoint is included in cleaned spec
- [ ] 2.2 Add appropriate `operationId` for delete trigger operation
- [ ] 2.3 Verify `Location` header requirement documentation

## 3. Webhook Payload Schema

- [ ] 3.1 Define `FulcrumWebhookPayload` schema for trigger output
- [ ] 3.2 Include common event fields (event type, timestamp, resource data)
- [ ] 3.3 Support all Fulcrum event types: records, forms, choice lists, classification sets
- [ ] 3.4 Add `x-ms-summary` to payload properties for Power Automate UI

## 4. Testing & Validation

- [ ] 4.1 Run full pipeline: download → convert → clean → augment
- [ ] 4.2 Verify `swagger-2.0-cleaned.yaml` passes all validation checks
- [ ] 4.3 Verify trigger extensions are present in output
- [ ] 4.4 Document manual testing steps for Power Automate import

## 5. Documentation

- [ ] 5.1 Update `AGENTS.md` with trigger augmentation validation steps
- [ ] 5.2 Document trigger configuration in README or separate doc
