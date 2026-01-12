# Change: Add Power Automate Trigger Support for Fulcrum Events

## Why

Power Automate custom connectors require specific OpenAPI extensions (`x-ms-trigger`, `x-ms-notification-url`, `x-ms-notification-content`) to expose webhook-based triggers. Without these extensions, the Fulcrum webhook registration endpoint appears only as an action in Power Automate, not as a trigger that can start flows when Fulcrum events occur.

Fulcrum webhooks support events for multiple resource types including records, forms, choice lists, and classification sets, with create/update/delete operations for each. The trigger must support all these event types to provide a complete integration experience.

## What Changes

- Add a new pipeline step (`trigger_augmenter.py`) that augments the cleaned Swagger 2.0 spec with Power Automate trigger extensions
- Modify `convert_openapi.sh` to call the trigger augmenter after cleaning
- Configure the webhook POST endpoint (`/v2/webhooks.json`) as a Power Automate trigger using:
  - `x-ms-trigger: single` to mark it as a trigger operation
  - `x-ms-notification-url: true` on the callback URL parameter
  - `x-ms-notification-content` to define the webhook payload schema
- Add `x-ms-summary` and `x-ms-visibility` extensions for better Power Automate UX
- Update validation to check for required trigger extensions

## Impact

- Affected specs: `conversion-pipeline`
- Affected code:
  - `scripts/convert_openapi.sh` - Add call to trigger augmenter
  - `scripts/trigger_augmenter.py` - New file for trigger augmentation
  - `scripts/validate.sh` - Add validation for trigger extensions
- Output: The final `fulcrum-power-automate-connector.yaml` will include trigger extensions, enabling "When a Fulcrum event occurs" trigger in Power Automate flows. The trigger supports all Fulcrum webhook event types: records, forms, choice lists, and classification sets (each with create, update, and delete operations)
