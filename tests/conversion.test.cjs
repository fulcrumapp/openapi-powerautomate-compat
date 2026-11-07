'use strict';

const assert = require('node:assert/strict');
const { execFile, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { promisify } = require('node:util');
const { downloadSchemas } = require('../scripts/download_schemas.cjs');
const { localSchemaFiles } = require('../scripts/schema_refs.cjs');

const execFileAsync = promisify(execFile);

const root = path.resolve(__dirname, '..');

function runPipeline(workDir) {
  return spawnSync('bash', ['scripts/run_pipeline.sh', '--skip-download', '--skip-validate'], {
    cwd: root,
    env: { ...process.env, WORK_DIR: workDir },
    encoding: 'utf8',
  });
}

function createFixture(t) {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'converter fixture '));
  t.after(() => fs.rmSync(workDir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(workDir, 'components', 'schemas'), { recursive: true });

  const webhook = {
    type: 'object',
    properties: {
      webhook: {
        type: 'object',
        required: ['name', 'url'],
        properties: {
          name: { type: 'string' },
          url: { type: 'string', format: 'uri' },
          active: { type: 'boolean', default: true },
        },
      },
    },
  };
  fs.writeFileSync(path.join(workDir, 'components', 'schemas', 'WebhookRequest.json'),
    JSON.stringify(webhook));
  const spec = {
    openapi: '3.1.0',
    info: { title: 'Fulcrum API', version: '2.0.0' },
    servers: [{ url: 'https://api.fulcrumapp.com/api' }],
    security: [{ api_key: [] }],
    paths: {
      '/v2/records.json': {
        get: {
          operationId: 'getRecords',
          parameters: [
            { name: 'x-apitoken', in: 'header', schema: { type: 'string' } },
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          ],
          responses: {
            200: {
              description: 'Records',
              content: {
                'application/json': {
                  schema: { type: 'array', items: { $ref: '#/components/schemas/Record' } },
                },
              },
            },
          },
        },
        post: {
          operationId: 'createRecord',
          requestBody: {
            required: true,
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Record' } },
            },
          },
          responses: { 201: { description: 'Created' } },
        },
      },
      '/v2/webhooks.json': {
        post: {
          operationId: 'createWebhook',
          requestBody: {
            required: true,
            content: {
              'application/json': { schema: { $ref: './components/schemas/WebhookRequest.json' } },
            },
          },
          responses: {
            201: {
              description: 'Created',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/WebhookRequest' } },
              },
            },
          },
        },
      },
      '/v2/webhooks/{webhook_id}.json': {
        delete: {
          operationId: 'deleteWebhook',
          parameters: [
            { name: 'webhook_id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: { 204: { description: 'Deleted' } },
        },
      },
    },
    components: {
      schemas: {
        Record: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            note: { type: ['string', 'null'] },
          },
        },
        WebhookRequest: webhook,
      },
      securitySchemes: {
        api_key: { type: 'apiKey', in: 'header', name: 'X-ApiToken' },
      },
    },
  };
  fs.writeFileSync(path.join(workDir, 'api-3.1.json'), JSON.stringify(spec));
  return workDir;
}

test('minimal install registers required formats without unused adapter chains', () => {
  const formats = require('api-spec-converter').Formats;
  assert.ok(formats.openapi_3);
  assert.ok(formats.swagger_2);
  for (const format of ['raml', 'api_blueprint', 'google', 'swagger_1']) {
    assert.equal(formats[format], undefined, `${format} should not be installed`);
  }

  const result = spawnSync('npm', ['ls', '--all', '--omit=dev', '--omit=optional', '--json'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  const names = new Set();
  function collect(tree) {
    for (const [name, dependency] of Object.entries(tree.dependencies || {})) {
      if (!dependency.version) continue;
      names.add(name);
      collect(dependency);
    }
  }
  collect(JSON.parse(result.stdout));
  for (const name of [
    'nomnom', 'jison', 'jison-lex', 'raml-parser', 'raml-to-swagger', 'apib2swagger',
    'drafter.js', 'google-discovery-to-swagger', 'swagger-converter',
  ]) {
    assert.ok(!names.has(name), `${name} should not be installed`);
  }
  assert.ok(names.has('swagger2openapi'));
});

test('full pipeline preserves external schemas, operations, triggers and certification', t => {
  const workDir = createFixture(t);
  const result = runPipeline(workDir);
  assert.equal(result.status, 0, result.stdout + result.stderr);

  const openapi = JSON.parse(fs.readFileSync(path.join(workDir, 'api-3.0.json')));
  assert.match(openapi.openapi, /^3\.0\./);
  assert.equal(openapi.components.schemas.Record.properties.note.nullable, true);

  const certDir = path.join(workDir, 'certified-connectors', 'Fulcrum');
  const spec = JSON.parse(fs.readFileSync(path.join(certDir, 'apiDefinition.swagger.json')));
  assert.equal(spec.swagger, '2.0');
  assert.equal(spec.info.version, '1.0.0');
  assert.equal(spec.host, 'api.fulcrumapp.com');
  assert.equal(spec.basePath, '/api');
  const records = spec.paths['/v2/records.json'];
  assert.equal(records.get.operationId, 'GetRecords');
  assert.equal(records.get.responses['200'].schema.items.$ref, '#/definitions/Record');
  assert.ok(!records.get.parameters.some(parameter => parameter.name === 'x-apitoken'));
  assert.equal(records.get.parameters.find(parameter => parameter.name === 'page').type, 'integer');
  assert.equal(records.post.parameters.find(parameter => parameter.in === 'body').required, true);
  assert.ok(spec.securityDefinitions.api_key);
  const trigger = spec.paths['/v2/webhooks.json'].post;
  assert.equal(trigger['x-ms-trigger'], 'single');
  assert.ok(spec.paths['/v2/webhooks.json']['x-ms-notification-content']);
  assert.ok(trigger.responses['201'].headers.Location);
  assert.equal(spec.paths['/v2/webhooks/{webhook_id}.json'].delete['x-ms-visibility'], 'internal');
  assert.ok(spec.definitions.FulcrumWebhookPayload);
  assert.equal(spec.definitions.WebhookRequest.properties.webhook.properties.url['x-ms-notification-url'], true);
  const callbackBody = trigger.parameters.find(parameter => parameter.in === 'body').schema;
  assert.equal(callbackBody.properties.webhook.properties.url['x-ms-notification-url'], true);
  assert.ok(!fs.readdirSync(workDir).some(name => name.startsWith('api-3.1-resolved.')));

  const properties = JSON.parse(fs.readFileSync(path.join(certDir, 'apiProperties.json')));
  assert.ok(properties.properties.connectionParameters.api_key);
  assert.ok(properties.properties.connectionParameters.hostUrl);
  assert.ok(properties.properties.policyTemplateInstances.some(policy => policy.templateId === 'dynamichosturl'));
  const readme = fs.readFileSync(path.join(certDir, 'README.md'), 'utf8');
  assert.match(readme, /^# Fulcrum/m);
  assert.match(readme, /Prerequisites/);
  assert.match(readme, /records/);
});

test('missing external schema stops conversion before certification', t => {
  const workDir = createFixture(t);
  fs.unlinkSync(path.join(workDir, 'components', 'schemas', 'WebhookRequest.json'));
  const result = runPipeline(workDir);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /External schema resolution failed/);
  assert.ok(!fs.existsSync(path.join(workDir, 'certified-connectors')));
  assert.ok(!fs.readdirSync(workDir).some(name => name.startsWith('api-3.1-resolved.')));
});

test('invalid input fails instead of producing a success-shaped package', t => {
  const workDir = createFixture(t);
  fs.writeFileSync(path.join(workDir, 'api-3.1.json'), '{invalid');
  const result = runPipeline(workDir);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /External schema resolution failed/);
  assert.ok(!fs.existsSync(path.join(workDir, 'certified-connectors')));
});

test('nested YAML schemas resolve relative to their own file before downgrade', t => {
  const workDir = createFixture(t);
  const inputPath = path.join(workDir, 'api-3.1.json');
  const input = JSON.parse(fs.readFileSync(inputPath));
  input.components.schemas.Record.properties.geometry = {
    $ref: './components/schemas/nested/Geometry.yaml#/Geometry',
  };
  fs.mkdirSync(path.join(workDir, 'components', 'schemas', 'nested'));
  fs.writeFileSync(path.join(workDir, 'components', 'schemas', 'nested', 'Geometry.yaml'),
    'Geometry:\n  type: object\n  properties:\n    latitude:\n      $ref: ../Latitude.json\n');
  fs.writeFileSync(path.join(workDir, 'components', 'schemas', 'Latitude.json'),
    JSON.stringify({ type: ['number', 'null'] }));
  fs.writeFileSync(inputPath, JSON.stringify(input));
  const result = runPipeline(workDir);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const spec = JSON.parse(fs.readFileSync(
    path.join(workDir, 'certified-connectors', 'Fulcrum', 'apiDefinition.swagger.json')));
  assert.equal(spec.definitions.Record.properties.geometry.properties.latitude.type, 'number');
  assert.equal(spec.definitions.Record.properties.geometry.properties.latitude['x-nullable'], true);
  assert.ok(!JSON.stringify(spec).includes('./components/'));
});

test('prunes unreachable model cycles while retaining referenced recursive models', t => {
  const workDir = createFixture(t);
  const inputPath = path.join(workDir, 'api-3.1.json');
  const input = JSON.parse(fs.readFileSync(inputPath));
  input.components.schemas.Record.properties.parent = { $ref: '#/components/schemas/Record' };
  input.components.schemas.UnusedA = {
    type: 'object',
    properties: { other: { $ref: '#/components/schemas/UnusedB' } },
  };
  input.components.schemas.UnusedB = {
    type: 'object',
    properties: { other: { $ref: '#/components/schemas/UnusedA' } },
  };
  fs.writeFileSync(inputPath, JSON.stringify(input));
  const result = runPipeline(workDir);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const spec = JSON.parse(fs.readFileSync(
    path.join(workDir, 'certified-connectors', 'Fulcrum', 'apiDefinition.swagger.json')));
  assert.equal(spec.definitions.Record.properties.parent.$ref, '#/definitions/Record');
  assert.equal(spec.definitions.UnusedA, undefined);
  assert.equal(spec.definitions.UnusedB, undefined);
});

test('inline webhook request receives callback lifecycle extensions', t => {
  const workDir = createFixture(t);
  const inputPath = path.join(workDir, 'api-3.1.json');
  const input = JSON.parse(fs.readFileSync(inputPath));
  input.paths['/v2/webhooks.json'].post.responses = { 201: { description: 'Created' } };
  delete input.components.schemas.WebhookRequest;
  fs.writeFileSync(inputPath, JSON.stringify(input));
  const result = runPipeline(workDir);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const spec = JSON.parse(fs.readFileSync(
    path.join(workDir, 'certified-connectors', 'Fulcrum', 'apiDefinition.swagger.json')));
  const body = spec.paths['/v2/webhooks.json'].post.parameters.find(parameter => parameter.in === 'body');
  assert.equal(body.schema.$ref, '#/definitions/WebhookRequest');
  assert.equal(spec.definitions.WebhookRequest.properties.webhook.properties.url['x-ms-notification-url'], true);
  assert.ok(spec.definitions.WebhookRequest.properties.webhook.required.includes('url'));
});

test('relative WORK_DIR keeps conversion and certification outputs in one directory', t => {
  const workDir = createFixture(t);
  const result = runPipeline(path.relative(root, workDir));
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.ok(fs.existsSync(path.join(workDir, 'certified-connectors', 'Fulcrum',
    'apiDefinition.swagger.json')));
  assert.ok(!fs.readdirSync(workDir).some(name => name.startsWith('api-3.1-resolved.')));
});

async function serveSchemas(t, documents) {
  const requests = [];
  const server = http.createServer((request, response) => {
    requests.push(request.url);
    if (!Object.hasOwn(documents, request.url)) {
      response.writeHead(404);
      response.end('Missing fixture');
      return;
    }
    response.end(documents[request.url]);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => {
    server.closeAllConnections();
    server.close(resolve);
  }));
  return { base: `http://127.0.0.1:${server.address().port}`, requests };
}

test('remote references in root and nested schemas fail without making HTTP requests', async t => {
  const workDir = createFixture(t);
  const { base, requests } = await serveSchemas(t, {});
  const inputPath = path.join(workDir, 'api-3.1.json');
  for (const nested of [false, true]) {
    const schema = { $ref: `${base}/must-not-be-fetched.json` };
    if (nested) {
      fs.writeFileSync(inputPath, JSON.stringify({ $ref: './nested.json' }));
      fs.writeFileSync(path.join(workDir, 'nested.json'), JSON.stringify(schema));
    } else {
      fs.writeFileSync(inputPath, JSON.stringify(schema));
    }
    await assert.rejects(execFileAsync(process.execPath, [
      'scripts/resolve_external_refs.cjs', inputPath, path.join(workDir, 'resolved.json'),
    ], { cwd: root, timeout: 10000 }), error => {
      assert.match(error.stderr, /Only local relative schema references are supported/);
      return true;
    });
  }
  assert.deepEqual(requests, []);
});

test('local-only reference policy rejects remote and absolute URI variants', () => {
  for (const reference of [
    'https://example.invalid/schema.json',
    '//example.invalid/schema.json',
    'file:///etc/hosts',
    '/etc/hosts',
    '\\\\example.invalid\\schema.json',
    'http%3A%2F%2Fexample.invalid/schema.json',
    '%2F%2Fexample.invalid/schema.json',
    ' https://example.invalid/schema.json',
  ]) {
    assert.throws(() => localSchemaFiles({ properties: { field: { $ref: reference } } }),
      /Invalid schema reference|Only local relative schema references/);
  }
});

test('download recursively supplies nested JSON/YAML schemas and deduplicates cycles', async t => {
  const workDir = createFixture(t);
  const inputPath = path.join(workDir, 'api-3.1.json');
  const input = JSON.parse(fs.readFileSync(inputPath));
  input.components.schemas.Record.properties.geometry = {
    $ref: './components/schemas/nested/Geometry.yaml#/Geometry',
  };
  fs.writeFileSync(inputPath, JSON.stringify(input));
  const webhook = fs.readFileSync(path.join(workDir, 'components', 'schemas', 'WebhookRequest.json'), 'utf8');
  fs.unlinkSync(path.join(workDir, 'components', 'schemas', 'WebhookRequest.json'));
  const documents = {
    '/reference/components/schemas/WebhookRequest.json': webhook,
    '/reference/components/schemas/nested/Geometry.yaml':
      'Geometry:\n  type: object\n  properties:\n    latitude:\n      $ref: ../Latitude.json\n',
    '/reference/components/schemas/Latitude.json': JSON.stringify({ type: ['number', 'null'] }),
  };
  const { base, requests } = await serveSchemas(t, documents);
  await downloadSchemas(inputPath, `${base}/reference/rest-api.json`);
  assert.deepEqual(requests.sort(), Object.keys(documents).sort());
  const result = runPipeline(workDir);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const spec = JSON.parse(fs.readFileSync(path.join(workDir,
    'certified-connectors', 'Fulcrum', 'apiDefinition.swagger.json')));
  assert.equal(spec.definitions.Record.properties.geometry.properties.latitude.type, 'number');

  documents['/reference/cycle.json'] = JSON.stringify({ $ref: './other.json' });
  documents['/reference/other.json'] = JSON.stringify({ $ref: './cycle.json' });
  fs.writeFileSync(inputPath, JSON.stringify({ $ref: './cycle.json' }));
  await downloadSchemas(inputPath, `${base}/reference/rest-api.json`);
  assert.equal(requests.filter(request => request === '/reference/cycle.json').length, 1);
  assert.equal(requests.filter(request => request === '/reference/other.json').length, 1);
  assert.ok(!requests.includes('/reference/rest-api.json'));
});

test('downloader rejects remote and escaping references without fetching them', async t => {
  const workDir = createFixture(t);
  const inputPath = path.join(workDir, 'api-3.1.json');
  const { base, requests } = await serveSchemas(t, {
    '/reference/nested.json': JSON.stringify({ $ref: '//example.invalid/schema.json' }),
  });
  fs.writeFileSync(inputPath, JSON.stringify({ $ref: './nested.json' }));
  await assert.rejects(downloadSchemas(inputPath, `${base}/reference/rest-api.json`),
    /Only local relative schema references are supported/);
  fs.writeFileSync(inputPath, JSON.stringify({ $ref: '../outside.json' }));
  await assert.rejects(downloadSchemas(inputPath, `${base}/reference/rest-api.json`),
    /leaves the specification directory/);
  assert.deepEqual(requests, ['/reference/nested.json']);
});

test('downloader reports HTTP failures instead of reusing stale schemas', async t => {
  const workDir = createFixture(t);
  const { base } = await serveSchemas(t, {});
  await assert.rejects(downloadSchemas(path.join(workDir, 'api-3.1.json'),
    `${base}/reference/rest-api.json`), /Failed to download.*HTTP 404/);
});
