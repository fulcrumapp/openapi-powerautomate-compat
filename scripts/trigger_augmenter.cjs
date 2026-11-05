'use strict';

const { readSpec, writeSpec } = require('./spec_io.cjs');

function createWebhookPayloadSchema() {
  return {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        'x-ms-summary': 'Event ID',
        description: 'The unique identifier of the event',
      },
      type: {
        type: 'string',
        'x-ms-summary': 'Event Type',
        description: 'The type of event (e.g., record.create, record.update, record.delete, form.create, form.update, form.delete, choice_list.create, choice_list.update, choice_list.delete, classification_set.create, classification_set.update, classification_set.delete)',
      },
      owner_id: {
        type: 'string',
        'x-ms-summary': 'Owner ID',
        description: 'The ID of the organization that owns this webhook',
      },
      data: {
        type: 'object',
        'x-ms-summary': 'Event Data',
        description: 'The record or resource data associated with the event',
      },
      created_at: {
        type: 'string',
        format: 'date-time',
        'x-ms-summary': 'Created At',
        description: 'The timestamp when the event occurred',
      },
    },
    description: 'Webhook event payload from Fulcrum',
  };
}

function augmentSpec(data, log = console.log) {
  if (data.swagger !== '2.0') log(`Warning: Expected Swagger 2.0, found version ${data.swagger}`);
  if (!data.paths) throw new Error('No paths found in specification');
  const endpoint = data.paths['/v2/webhooks.json'];
  if (!endpoint) throw new Error('Webhook endpoint /v2/webhooks.json not found in spec');
  const post = endpoint.post;
  if (!post) throw new Error('POST method not found for /v2/webhooks.json');

  const webhookSchemas = [];
  for (const parameter of post.parameters || []) {
    const schema = parameter.schema || {};
    if (parameter.in === 'body' && Object.hasOwn(schema.properties || {}, 'webhook')) {
      data.definitions ??= {};
      if (!Object.hasOwn(data.definitions, 'WebhookRequest')) {
        data.definitions.WebhookRequest = schema;
        parameter.schema = { $ref: '#/definitions/WebhookRequest' };
      } else {
        webhookSchemas.push(schema);
      }
    }
  }
  post['x-ms-trigger'] = 'single';
  post['x-ms-trigger-hint'] = 'To see it work, create, update, or delete a record, form, choice list, or classification set in Fulcrum';
  post.operationId = 'OnFulcrumEvent';
  post.summary = 'When a Fulcrum event occurs';
  post.description = 'Triggers when a Fulcrum resource is created, updated, or deleted. ' +
    'Supports events for records, forms, choice lists, and classification sets. ' +
    'Configure the webhook in your Fulcrum organization to specify which events to monitor.';

  let foundCallback = false;
  for (const parameter of post.parameters || []) {
    if (['url', 'callback_url', 'webhook_url'].includes(parameter.name)) {
      parameter['x-ms-notification-url'] = true;
      parameter['x-ms-visibility'] = 'internal';
      parameter['x-ms-summary'] = 'Callback URL';
      if (!Object.hasOwn(parameter, 'description')) {
        parameter.description = 'The callback URL where Fulcrum will send webhook events';
      }
      foundCallback = true;
      break;
    }
    if (parameter.in === 'body' && parameter.name === 'body') {
      parameter.required = true;
      foundCallback = true;
      log('Marked body parameter as required in webhook POST endpoint');
      break;
    }
  }
  if (!foundCallback) throw new Error('No callback URL parameter found in webhook POST endpoint');
  endpoint['x-ms-notification-content'] = {
    description: 'Webhook event payload from Fulcrum',
    schema: { $ref: '#/definitions/FulcrumWebhookPayload' },
  };
  const response = post.responses?.['201'] || post.responses?.['200'];
  if (response && Object.keys(response).length) {
    if (response.schema?.properties) {
      response.schema.properties._webhook_payload_example = { $ref: '#/definitions/FulcrumWebhookPayload' };
    }
    response.headers ??= {};
    response.headers.Location = {
      type: 'string',
      description: 'URL to manage (update/delete) the created webhook',
      'x-ms-summary': 'Webhook Management URL',
    };
  }
  log('Successfully augmented webhook endpoint with Power Automate extensions');

  const deleteEndpoint = data.paths['/v2/webhooks/{webhook_id}.json'];
  const unsubscribe = deleteEndpoint?.delete;
  if (unsubscribe) {
    unsubscribe['x-ms-visibility'] = 'internal';
    unsubscribe.operationId = 'UnsubscribeFromFulcrumEvent';
    if (!Object.hasOwn(unsubscribe, 'x-ms-summary')) unsubscribe['x-ms-summary'] = 'Delete webhook';
    if (!Object.hasOwn(unsubscribe, 'description')) {
      unsubscribe.description = 'Deletes a webhook subscription. This is called automatically by Power Automate ' +
        'when a flow using this trigger is deleted or modified.';
    }
    log('Webhook delete endpoint configured as internal action');
  } else {
    log(deleteEndpoint ? 'DELETE method not found for /v2/webhooks/{webhook_id}.json' :
      'Webhook delete endpoint /v2/webhooks/{webhook_id}.json not found in spec');
    log('Warning: Webhook delete endpoint not found or incomplete');
  }
  data.definitions ??= {};
  data.definitions.FulcrumWebhookPayload = createWebhookPayloadSchema();
  log('Added FulcrumWebhookPayload schema to definitions');
  if (Object.hasOwn(data.definitions, 'WebhookRequest')) {
    webhookSchemas.push(data.definitions.WebhookRequest);
  }
  for (const schema of webhookSchemas) {
    const webhook = schema.properties?.webhook;
    if (!webhook?.properties) continue;
    if (Object.hasOwn(webhook.properties, 'url')) {
      webhook.required ??= [];
      if (!webhook.required.includes('url')) webhook.required.push('url');
      delete webhook.minProperties;
      const url = webhook.properties.url;
      url['x-ms-notification-url'] = true;
      url['x-ms-visibility'] = 'internal';
      if (!Object.hasOwn(url, 'x-ms-summary')) url['x-ms-summary'] = 'Callback URL';
      log('Augmented webhook.url with x-ms-notification-url');
    }
    if (Object.hasOwn(webhook.properties, 'name')) {
      const name = webhook.properties.name;
      name.default = 'Power Platform Trigger';
      if (!Object.hasOwn(name, 'x-ms-summary')) name['x-ms-summary'] = 'Webhook Name';
      log('Added default value to webhook.name');
    }
  }
  return data;
}

module.exports = { augmentSpec, createWebhookPayloadSchema };

if (require.main === module) {
  try {
    const [input, output] = process.argv.slice(2);
    if (!input || ['-h', '--help'].includes(input)) {
      throw new Error('Usage: node trigger_augmenter.cjs <input_file> [output_file]\n' +
        'If output_file is not specified, the input file is updated in-place.');
    }
    const data = augmentSpec(readSpec(input));
    writeSpec(output || input, data, input);
    console.log(`Successfully augmented ${input}`);
    console.log(output ? `Output written to ${output}` : 'Updated file in-place');
  } catch (error) {
    console.error(`Error augmenting specification: ${error.message}`);
    process.exitCode = 1;
  }
}
