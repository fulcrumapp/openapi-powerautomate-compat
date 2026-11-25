'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const yaml = require('js-yaml');
const { cleanSpec, findUsedModels, getEndpointName, loadConfig } = require('../scripts/swagger_cleaner.cjs');
const { augmentSpec } = require('../scripts/trigger_augmenter.cjs');
const { validateConfig, generateApiProperties, generateReadme, packageConnector } =
  require('../scripts/certification_packager.cjs');
const { readSpec } = require('../scripts/spec_io.cjs');

const root = path.resolve(__dirname, '..');
const quiet = () => {};

function temporaryDirectory(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "Node converter's fixtures "));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function run(script, args) {
  return spawnSync(process.execPath, [path.join(root, 'scripts', script), ...args], { encoding: 'utf8' });
}

function webhookSpec(schema) {
  return {
    swagger: '2.0',
    paths: {
      '/v2/webhooks.json': {
        post: {
          parameters: [{ name: 'body', in: 'body', schema }],
          responses: { 201: { description: 'Created', schema: { type: 'object', properties: {} } } },
        },
      },
      '/v2/webhooks/{webhook_id}.json': { delete: { responses: { 204: { description: 'Deleted' } } } },
    },
  };
}

function webhookSchema() {
  return {
    type: 'object',
    properties: {
      webhook: {
        type: 'object',
        minProperties: 1,
        properties: { url: { type: 'string' }, name: { type: 'string' } },
      },
    },
  };
}

test('cleaner preserves filtering, parameter, metadata, response and composition contracts', () => {
  const config = {
    swaggerCleaner: {
      endpointsToKeep: ['/v2/records/{id}.json/get', '/v2/records/{id}.json/delete'],
      parametersToRemove: [{ name: 'X-ApiToken', in: 'header' }, { name: 'accept' }],
      info: {
        description: 'A sufficiently long configured connector description.',
        contact: { name: 'Support' },
      },
      connectorMetadata: [{ propertyName: 'Website', propertyValue: 'https://example.com' }],
    },
  };
  const input = {
    info: { title: 'Example API Connector !!!', description: 'short', 'x-ms-connector-metadata': [] },
    security: [{ api_key: [] }],
    securityDefinitions: { api_key: { type: 'apiKey', name: 'X-ApiToken', in: 'header' } },
    paths: {
      '/v2/records/{id}.json': {
        parameters: [{ name: 'shared', in: 'query', type: 'string' }],
        'x-ms-test': { enabled: true },
        GET: {
          operationId: 'getRecords',
          parameters: [
            { name: 'x-apitoken', in: 'header', type: 'string' },
            { name: 'x-apitoken', in: 'query', type: 'string' },
            { name: 'Accept', in: 'query', type: 'string' },
            { name: 'id', in: 'path', type: 'string' },
            { name: 'camelCase_value-name', in: 'query', type: 'string' },
            { name: 'x-skipWorkflows', in: 'header', type: 'boolean' },
            { name: 'x-skipwebhooks', in: 'header', type: 'boolean', description: '', 'x-ms-summary': '' },
          ],
          responses: {
            200: { description: 'OK', schema: { $ref: '#/definitions/Record', description: 'remove',
              title: 'remove', 'x-ms-test': { retained: true } } },
            206: { description: 'Partial' },
            400: { description: 'Error', schema: { $ref: '#/definitions/Error' } },
          },
        },
        delete: {
          description: 'Keep existing description',
          parameters: [{ name: 'x-apitoken', in: 'header' }],
          responses: { 204: { description: 'Deleted', schema: { $ref: '#/definitions/EmptySuccessResponse' } } },
        },
        post: { responses: { 201: { description: 'Not retained' } } },
      },
      '/v2/excluded.json': { get: { responses: {} } },
    },
    definitions: {
      Record: {
        type: 'object',
        properties: {
          self: { $ref: '#/definitions/Record', description: 'remove' },
          flexible: { type: 'string', anyOf: [{ type: 'string' }], oneOf: [{ type: 'string' }] },
          composed: { allOf: [{ type: 'object' }] },
        },
      },
      Error: { type: 'object' },
      EmptySuccessResponse: { type: 'object' },
    },
  };
  const original = structuredClone(input);
  const cleaned = cleanSpec(input, config, quiet);
  assert.deepEqual(input, original);
  assert.equal(cleaned.info.title, 'Example');
  assert.equal(cleaned.info.description, config.swaggerCleaner.info.description);
  assert.deepEqual(cleaned.info.contact, { name: 'Support' });
  assert.equal(cleaned.info['x-ms-connector-metadata'], undefined);
  assert.deepEqual(cleaned['x-ms-connector-metadata'], config.swaggerCleaner.connectorMetadata);
  assert.deepEqual(cleaned.security, input.security);
  assert.deepEqual(cleaned.securityDefinitions, input.securityDefinitions);
  assert.equal(cleaned.paths['/v2/excluded.json'], undefined);
  const endpoint = cleaned.paths['/v2/records/{id}.json'];
  assert.deepEqual(endpoint.parameters, input.paths['/v2/records/{id}.json'].parameters);
  assert.deepEqual(endpoint['x-ms-test'], { enabled: true });
  assert.equal(endpoint.post, undefined);
  assert.equal(endpoint.GET.operationId, 'GetRecords');
  assert.equal(endpoint.GET.description, 'Records GET');
  assert.deepEqual(Object.keys(endpoint.GET.responses), ['200', '206']);
  assert.deepEqual(endpoint.GET.responses['200'].schema,
    { $ref: '#/definitions/Record', 'x-ms-test': { retained: true } });
  assert.deepEqual(endpoint.GET.parameters.map(parameter => parameter.name),
    ['x-apitoken', 'id', 'camelCase_value-name', 'x-skipWorkflows', 'x-skipwebhooks']);
  assert.equal(endpoint.GET.parameters[1]['x-ms-url-encoding'], 'single');
  assert.equal(endpoint.GET.parameters[2]['x-ms-summary'], 'Camelcase Value Name');
  assert.equal(endpoint.GET.parameters[2].description, 'Camelcase Value Name');
  assert.equal(endpoint.GET.parameters[3]['x-ms-visibility'], 'advanced');
  assert.equal(endpoint.GET.parameters[4]['x-ms-visibility'], 'advanced');
  assert.equal(endpoint.GET.parameters[4].description, '');
  assert.equal(endpoint.GET.parameters[4]['x-ms-summary'], '');
  assert.equal(endpoint.delete.parameters, undefined);
  assert.equal(endpoint.delete.description, 'Keep existing description');
  assert.equal(endpoint.delete.responses['204'].schema, undefined);
  assert.deepEqual(Object.keys(cleaned.definitions), ['Record']);
  assert.deepEqual(cleaned.definitions.Record.properties.flexible, { type: 'string' });
  assert.deepEqual(cleaned.definitions.Record.properties.composed, { allOf: [{ type: 'object' }] });
});

test('model reachability follows escaped definition names and extensions, not unused chains', () => {
  const data = {
    'x-ms-notification-content': { schema: { $ref: '#/definitions/Model~1Name~0/properties/id' } },
    definitions: {
      'Model/Name~': { properties: { self: { $ref: '#/definitions/Model~1Name~0' } } },
      UnusedA: { $ref: '#/definitions/UnusedB' },
      UnusedB: { $ref: '#/definitions/UnusedA' },
    },
  };
  assert.deepEqual([...findUsedModels(data)], ['Model/Name~']);
  assert.deepEqual(Object.keys(cleanSpec(data, { swaggerCleaner: {} }, quiet).definitions), ['Model/Name~']);
});

test('cleaner keeps all operations with an empty filter and preserves existing metadata', () => {
  const input = {
    info: { title: 'Example', description: 'An existing sufficiently long description.', contact: {} },
    'x-ms-connector-metadata': [],
    paths: { '/v2/webhooks.json': { post: { parameters: [{ in: 'body', name: 'body',
      schema: { $ref: '#/definitions/WebhookRequest' } }], responses: {} } } },
    definitions: { WebhookRequest: webhookSchema() },
  };
  const cleaned = cleanSpec(input, { swaggerCleaner: {
    info: { description: 'replacement', contact: { name: 'replacement' } },
    connectorMetadata: [{ propertyName: 'replacement' }],
  } }, quiet);
  assert.equal(cleaned.info.description, input.info.description);
  assert.deepEqual(cleaned.info.contact, {});
  assert.deepEqual(cleaned['x-ms-connector-metadata'], []);
  const webhook = cleaned.definitions.WebhookRequest.properties.webhook;
  assert.deepEqual(webhook.required, ['url']);
  assert.equal(webhook.minProperties, undefined);
});

test('endpoint labels preserve version-prefix and extension handling', () => {
  for (const [endpoint, expected] of [['/', 'Root'], ['/v2', 'API'], ['/API/records.json', 'records'],
    ['/version12/photos.jpg', 'photos'], ['/records.json', 'records'], ['/v2x/items', 'v2x']]) {
    assert.equal(getEndpointName(endpoint), expected);
  }
});

test('trigger promotes inline schemas and configures the complete callback lifecycle idempotently', () => {
  const data = webhookSpec(webhookSchema());
  augmentSpec(data, quiet);
  const post = data.paths['/v2/webhooks.json'].post;
  assert.deepEqual(post.parameters[0].schema, { $ref: '#/definitions/WebhookRequest' });
  assert.equal(post.parameters[0].required, true);
  assert.equal(post.operationId, 'OnFulcrumEvent');
  assert.equal(post['x-ms-trigger'], 'single');
  assert.equal(post.summary, 'When a Fulcrum event occurs');
  assert.equal(post.responses['201'].headers.Location['x-ms-summary'], 'Webhook Management URL');
  assert.deepEqual(post.responses['201'].schema.properties._webhook_payload_example,
    { $ref: '#/definitions/FulcrumWebhookPayload' });
  assert.deepEqual(data.paths['/v2/webhooks.json']['x-ms-notification-content'].schema,
    { $ref: '#/definitions/FulcrumWebhookPayload' });
  assert.equal(data.paths['/v2/webhooks/{webhook_id}.json'].delete.operationId, 'UnsubscribeFromFulcrumEvent');
  assert.equal(data.paths['/v2/webhooks/{webhook_id}.json'].delete['x-ms-visibility'], 'internal');
  const webhook = data.definitions.WebhookRequest.properties.webhook;
  assert.equal(webhook.properties.url['x-ms-notification-url'], true);
  assert.equal(webhook.properties.url['x-ms-visibility'], 'internal');
  assert.equal(webhook.properties.name.default, 'Power Platform Trigger');
  assert.equal(webhook.minProperties, undefined);
  assert.deepEqual(webhook.required, ['url']);
  const once = structuredClone(data);
  augmentSpec(data, quiet);
  assert.deepEqual(data, once);
});

test('trigger augments both named and inline request schemas without replacing either', () => {
  const data = webhookSpec(webhookSchema());
  data.definitions = { WebhookRequest: webhookSchema() };
  data.definitions.WebhookRequest.properties.webhook.properties.url['x-ms-summary'] = 'Preserve URL label';
  augmentSpec(data, quiet);
  const schemas = [data.definitions.WebhookRequest, data.paths['/v2/webhooks.json'].post.parameters[0].schema];
  for (const schema of schemas) {
    assert.equal(schema.properties.webhook.properties.url['x-ms-notification-url'], true);
    assert.equal(schema.properties.webhook.properties.name.default, 'Power Platform Trigger');
    assert.deepEqual(schema.properties.webhook.required, ['url']);
  }
  assert.equal(data.definitions.WebhookRequest.properties.webhook.properties.url['x-ms-summary'],
    'Preserve URL label');
});

for (const name of ['url', 'callback_url', 'webhook_url']) {
  test(`trigger supports direct ${name} callbacks and the 200 success response`, () => {
    const data = webhookSpec({});
    const post = data.paths['/v2/webhooks.json'].post;
    post.parameters = [{ name, in: 'query', type: 'string' }];
    post.responses = { 200: { description: 'OK' } };
    augmentSpec(data, quiet);
    assert.equal(post.parameters[0]['x-ms-notification-url'], true);
    assert.equal(post.parameters[0]['x-ms-visibility'], 'internal');
    assert.ok(post.responses['200'].headers.Location);
  });
}

test('trigger reports missing unsubscribe as advisory but fails for a missing callback', () => {
  const data = webhookSpec({});
  delete data.paths['/v2/webhooks/{webhook_id}.json'];
  const messages = [];
  augmentSpec(data, message => messages.push(message));
  assert.ok(messages.some(message => message.startsWith('Warning: Webhook delete endpoint')));
  const invalid = webhookSpec({});
  invalid.paths['/v2/webhooks.json'].post.parameters = [];
  assert.throws(() => augmentSpec(invalid, quiet), /No callback URL parameter/);
});

test('packager preserves connection defaults (including false/zero), constraints and policy parameters', () => {
  const config = {
    iconBrandColor: '#123456',
    authentication: { type: 'apiKey' },
    connectionParameters: {
      hostUrl: { type: 'string', default: 'example.com', uiDefinition: { constraints: { required: false } } },
      flag: { type: 'bool', default: false, uiDefinition: {} },
      count: { type: 'int', default: 0, uiDefinition: {} },
    },
    policyTemplates: [{ templateId: 'dynamichosturl', parameters: { expression: "@connectionParameters('hostUrl')" } }],
  };
  const original = structuredClone(config);
  const properties = generateApiProperties(config).properties;
  assert.deepEqual(config, original);
  assert.deepEqual(Object.keys(properties.connectionParameters), ['hostUrl', 'flag', 'count']);
  assert.deepEqual(properties.connectionParameters.hostUrl.uiDefinition.constraints,
    { required: false, default: 'example.com' });
  assert.equal(properties.connectionParameters.flag.uiDefinition.constraints.default, false);
  assert.equal(properties.connectionParameters.count.uiDefinition.constraints.default, 0);
  assert.deepEqual(properties.policyTemplateInstances, [{
    templateId: 'dynamichosturl', title: 'dynamichosturl',
    parameters: { expression: "@connectionParameters('hostUrl')" },
  }]);
  assert.deepEqual(generateApiProperties({ iconBrandColor: '#123456' }).properties, {
    connectionParameters: {}, iconBrandColor: '#123456', capabilities: [], policyTemplateInstances: [],
  });
});

test('packager rejects missing required fields, connection fields and policy fields before writing', t => {
  const config = loadConfig();
  for (const field of ['publisher', 'displayName', 'iconBrandColor', 'supportEmail', 'prerequisites',
    'knownLimitations', 'version']) {
    const invalid = { ...config };
    delete invalid[field];
    assert.throws(() => validateConfig(invalid), new RegExp(field));
  }
  for (const [section, entry, error] of [
    ['connectionParameters', { broken: { uiDefinition: {} } }, /'broken' missing 'type'/],
    ['connectionParameters', { broken: { type: 'string' } }, /'broken' missing 'uiDefinition'/],
    ['policyTemplates', [{ parameters: {} }], /missing 'templateId'/],
    ['policyTemplates', [{ templateId: 'test' }], /missing 'parameters'/],
  ]) {
    assert.throws(() => validateConfig({ ...config, [section]: entry }), error);
  }
  const output = path.join(temporaryDirectory(t), 'package');
  assert.throws(() => packageConnector({}, {}, output, quiet), /Missing required fields/);
  assert.equal(fs.existsSync(output), false);
});

test('packager rejects non-string versions before creating certification artifacts', t => {
  const config = loadConfig();
  const directory = temporaryDirectory(t);
  for (const [index, version] of [1, true, ['1.0.0'], { value: '1.0.0' }].entries()) {
    const output = path.join(directory, `package-${index}`);
    assert.throws(() => packageConnector(
      { swagger: '2.0', info: {} }, { ...config, version }, output, quiet),
    /version.*must be a string/);
    assert.equal(fs.existsSync(output), false);
  }
  assert.doesNotThrow(() => validateConfig({ ...config, version: '1' }));
});

test('packager emits the same three artifacts and overrides only packaged title/version', t => {
  const config = loadConfig();
  const input = {
    swagger: '2.0', info: { title: 'Source API', version: '2.0.0' },
    security: [{ api_key: [] }], paths: {},
  };
  const output = path.join(temporaryDirectory(t), 'package');
  packageConnector(input, config, output, quiet);
  assert.deepEqual(fs.readdirSync(output).sort(), ['README.md', 'apiDefinition.swagger.json', 'apiProperties.json']);
  assert.equal(input.info.title, 'Source API');
  assert.equal(input.info.version, '2.0.0');
  const definition = readSpec(path.join(output, 'apiDefinition.swagger.json'));
  assert.deepEqual(definition.info, { title: 'Fulcrum', version: config.version });
  assert.deepEqual(definition.security, input.security);
  assert.equal(fs.readFileSync(path.join(output, 'README.md'), 'utf8'), generateReadme(config, definition));
});

test('README uses configured sections, excludes internal actions and preserves operation order', () => {
  const config = {
    publisher: 'Publisher', displayName: 'Example', prerequisites: ['Subscription'],
    knownLimitations: ['Rate limits'], authentication: { description: 'Authenticate here', tooltip: 'Token help' },
    obtainingCredentials: 'Not selected', gettingStarted: '  Start here  ',
    connectionParameters: { hostUrl: {} }, faqs: [{ question: 'Why?', answer: 'Because.' }, {}],
    deploymentInstructions: '  Deploy here  ', swaggerCleaner: { info: { description: '  Description  ' } },
  };
  const spec = { paths: { '/events': {
    post: { summary: 'Trigger', description: 'Triggered', 'x-ms-trigger': 'single', 'x-ms-visibility': 'internal' },
    get: { summary: 'First action', description: 'First details' },
    put: { summary: 'Hidden', 'x-ms-visibility': 'internal' },
    parameters: [],
  }, '/records': { get: { summary: 'Second action' } } } };
  const readme = generateReadme(config, spec);
  assert.match(readme, /^# Example\n\nDescription\n/m);
  for (const content of ['### Triggers', '#### Trigger\nTriggered', '#### First action\nFirst details',
    '#### Second action', 'Authenticate here\n\nToken help', '## Getting Started\n\nStart here',
    '### Custom Host URLs', '### Why?\nBecause.', '## Deployment Instructions\n\nDeploy here\n']) {
    assert.ok(readme.includes(content), content);
  }
  assert.ok(readme.indexOf('First action') < readme.indexOf('Second action'));
  assert.ok(!readme.includes('Hidden'));
  assert.ok(!readme.includes('Not selected'));
});

test('README credentials fallbacks and optional sections match configuration', () => {
  const config = { publisher: 'Example', prerequisites: [], knownLimitations: [] };
  const readme = generateReadme(config, {});
  assert.match(readme, /Contact the service provider/);
  assert.match(readme, /No known issues or limitations/);
  assert.ok(!readme.includes('## Getting Started'));
  assert.ok(!readme.includes('## Frequently Asked Questions'));
  assert.match(generateReadme({ ...config, obtainingCredentials: '  Explicit instructions  ' }, {}),
    /Explicit instructions\n/);
  assert.match(generateReadme({ ...config, connectionParameters: { api_key: { uiDefinition: { tooltip: 'Token tip' } } } }, {}),
    /Token tip/);
  assert.match(generateReadme({ ...config, connectionParameters: { api_key: {} } }, {}), /need an API token/);
});

test('CLI contracts preserve JSON/YAML, default cleaned suffix, endpoint listing and in-place augmentation', t => {
  const directory = temporaryDirectory(t);
  for (const extension of ['json', 'yaml', 'yml', 'YAML']) {
    const input = path.join(directory, `swagger.${extension}`);
    const spec = webhookSpec(webhookSchema());
    spec.paths['/v2/webhooks.json'].post.operationId = 'createWebhook';
    spec.paths['/v2/webhooks.json'].parameters = [];
    fs.writeFileSync(input, extension === 'json' ? JSON.stringify(spec) : yaml.dump(spec));
    const listing = run('swagger_cleaner.cjs', ['--list-endpoints', input]);
    assert.equal(listing.status, 0, listing.stderr);
    assert.equal(listing.stdout, 'Available endpoints:\n  "/v2/webhooks.json/post",\n  "/v2/webhooks/{webhook_id}.json/delete",\n');
    const cleaned = path.join(directory, `swagger-cleaned.${extension}`);
    const result = run('swagger_cleaner.cjs', [input]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readSpec(cleaned).paths['/v2/webhooks.json'].post.operationId, 'CreateWebhook');
    const augmented = run('trigger_augmenter.cjs', [cleaned]);
    assert.equal(augmented.status, 0, augmented.stderr);
    assert.equal(readSpec(cleaned).paths['/v2/webhooks.json'].post.operationId, 'OnFulcrumEvent');
    const explicitOutput = path.join(directory, `different-suffix-${extension}.txt`);
    const explicit = run('trigger_augmenter.cjs', [cleaned, explicitOutput]);
    assert.equal(explicit.status, 0, explicit.stderr);
    const content = fs.readFileSync(explicitOutput, 'utf8');
    assert.deepEqual(extension === 'json' ? JSON.parse(content) : yaml.load(content), readSpec(cleaned));
  }
});

test('CLI failures are explicit and leave no output files', t => {
  const directory = temporaryDirectory(t);
  const input = path.join(directory, 'input.yaml');
  const output = path.join(directory, 'output.yaml');
  const config = path.join(directory, 'config.yaml');
  for (const script of ['swagger_cleaner.cjs', 'trigger_augmenter.cjs', 'certification_packager.cjs', 'spec_io.cjs']) {
    const missingArgs = run(script, []);
    assert.notEqual(missingArgs.status, 0);
    assert.match(missingArgs.stderr, /Usage:/);
  }
  for (const content of ['invalid: [', '', '[]', 'null']) {
    fs.writeFileSync(input, content);
    for (const script of ['swagger_cleaner.cjs', 'trigger_augmenter.cjs', 'spec_io.cjs']) {
      const result = run(script, script === 'spec_io.cjs' ? [input] : [input, output]);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Error/);
      assert.equal(fs.existsSync(output), false);
    }
  }
  fs.writeFileSync(input, yaml.dump(webhookSpec({})));
  fs.writeFileSync(config, '{}');
  const result = run('certification_packager.cjs', [input, config, path.join(directory, 'package')]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing required fields/);
  assert.equal(fs.existsSync(path.join(directory, 'package')), false);
  fs.writeFileSync(config, 'publisher: Example\n');
  assert.throws(() => loadConfig(config), /missing 'swaggerCleaner'/);
});
