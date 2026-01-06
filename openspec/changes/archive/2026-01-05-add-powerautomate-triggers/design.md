# Design: Power Automate Trigger Augmentation

## Context

Power Automate requires specific Microsoft OpenAPI extensions to recognize an endpoint as a trigger (rather than an action). The Fulcrum API provides webhook registration (`POST /v2/webhooks.json`) and deletion (`DELETE /v2/webhooks/{webhook_id}.json`) endpoints that can be configured as webhook triggers.

**Stakeholders:**
- Power Automate users who want to trigger flows on Fulcrum events (records, forms, choice lists, classification sets)
- Fulcrum API consumers building integrations

**Constraints:**
- Must maintain Swagger 2.0 compatibility
- Must not break existing validation pipeline
- Must preserve all existing endpoint functionality

## Goals / Non-Goals

### Goals
- Enable the Fulcrum webhook endpoint to appear as a trigger in Power Automate
- Provide a good user experience with descriptive summaries and hints
- Define webhook payload schema for dynamic content in flows
- Maintain validation pass rate (zero warnings/errors)

### Non-Goals
- Supporting multiple trigger types (only webhook/single supported initially)
- Supporting polling triggers (requires different architecture)
- Modifying the Fulcrum API itself (only augmenting the spec)

## Decisions

### Decision 1: Separate Augmentation Script

**What:** Create a new `trigger_augmenter.py` script rather than adding to `swagger_cleaner.py`

**Why:** 
- Single responsibility principle - cleaning and augmenting are distinct concerns
- Easier to test and maintain independently
- Can be disabled/enabled separately if needed
- Cleaner pipeline: download → convert → clean → augment → validate

**Alternatives considered:**
- Integrate into `swagger_cleaner.py` - Rejected: mixes concerns, harder to test
- Use jq/yq shell commands - Rejected: complex transformations, harder to maintain

### Decision 2: Trigger Configuration Structure

**What:** Use the following Power Automate extension pattern:

```yaml
paths:
  /v2/webhooks.json:
    x-ms-notification-content:
      description: Webhook event payload from Fulcrum
      schema:
        $ref: '#/definitions/FulcrumWebhookPayload'
    post:
      x-ms-trigger: single
      x-ms-trigger-hint: "To see it work, create or update a record in Fulcrum"
      summary: "When a Fulcrum event occurs"
      parameters:
        - name: url
          x-ms-notification-url: true
          x-ms-visibility: internal
      responses:
        '201':
          description: Webhook created
          headers:
            Location:
              type: string
              description: URL to manage (update/delete) the created webhook
              x-ms-summary: Webhook Management URL
```

**Why:**
- `x-ms-trigger: single` - Standard for webhook triggers returning single events
- `x-ms-notification-url: true` - Required for Power Automate to inject callback URL
- `x-ms-notification-content` at path level - Defines the webhook payload schema
- `x-ms-visibility: internal` on URL param - Hides the technical callback URL from users
- `Location` header in 201 response - **Required** for Power Automate to delete webhooks when flows are removed or modified. Without this header, webhook subscriptions will accumulate and cannot be cleaned up automatically. The header value should be the URL of the DELETE endpoint (e.g., `/v2/webhooks/{webhook_id}.json`).

**Reference:** [Microsoft Documentation - Create a webhook trigger](https://learn.microsoft.com/en-us/connectors/custom-connectors/create-webhook-trigger)

### Decision 3: Webhook Payload Schema

**What:** Define a generic `FulcrumWebhookPayload` schema covering common event fields:

```yaml
definitions:
  FulcrumWebhookPayload:
    type: object
    properties:
      id:
        type: string
        x-ms-summary: Event ID
      type:
        type: string
        x-ms-summary: Event Type
        description: "The type of event (e.g., record.create, form.update, choice_list.delete, classification_set.create)"
      owner_id:
        type: string
        x-ms-summary: Owner ID
      data:
        type: object
        x-ms-summary: Event Data
        description: "The resource data (record, form, choice list, or classification set)"
```

**Why:**
- Provides typed output for Power Automate dynamic content
- `x-ms-summary` improves discoverability in the Power Automate designer
- Generic schema works for all Fulcrum event types (records, forms, choice lists, classification sets)

**Alternatives considered:**
- Event-specific schemas per event type - Rejected: requires dynamic schema support, more complex
- No schema (raw object) - Rejected: poor UX, no dynamic content suggestions

### Decision 4: Pipeline Integration Point

**What:** Add trigger augmentation as the final transformation step before validation:

```
download → convert (3.1→3.0→2.0) → clean → augment → validate
```

**Why:**
- Augmentation depends on cleaned spec having correct structure
- Augmenter can assume stable input format
- Validation runs last to catch any issues from any step

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Webhook payload schema may not match actual Fulcrum events | Document that schema is illustrative; users should test with actual events |
| Power Automate may have undocumented extension requirements | Test import thoroughly; monitor for validation errors in Power Automate |
| Future Fulcrum API changes may break trigger | Pin to specific API version; document update process |

## Migration Plan

1. Add new `trigger_augmenter.py` script
2. Update `convert_openapi.sh` to call augmenter
3. Update `validate.sh` to check for trigger extensions
4. Run full validation pipeline
5. Test import in Power Automate
6. Update documentation

**Rollback:** Remove augmenter call from `convert_openapi.sh` to revert to action-only spec

## Open Questions

1. **Q:** Should we support dynamic schemas for different event types?  
   **A:** Deferred to future enhancement; start with generic schema

2. **Q:** What specific Fulcrum event types should be documented?  
   **A:** All event types from Fulcrum webhook documentation (https://docs.fulcrumapp.com/docs/webhooks):
   - **Records**: record.create, record.update, record.delete
   - **Forms**: form.create, form.update, form.delete
   - **Choice Lists**: choice_list.create, choice_list.update, choice_list.delete
   - **Classification Sets**: classification_set.create, classification_set.update, classification_set.delete

3. **Q:** Should the trigger support filtering by event type in the UI?

4. **Q:** Why must the DELETE webhook endpoint be marked as internal?  
   **A:** Per [Microsoft documentation](https://learn.microsoft.com/en-us/training/modules/create-triggers-custom-connectors/2-webhook-trigger), the delete endpoint must have `x-ms-visibility: internal` so Power Automate can use it for trigger cleanup without exposing it as a user-visible action in the connector UI. This is required for proper webhook lifecycle management.  
   **A:** Requires `x-ms-dynamic-values` - consider for future enhancement
