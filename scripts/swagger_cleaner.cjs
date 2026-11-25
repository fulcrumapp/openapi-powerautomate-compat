'use strict';

const path = require('node:path');
const { isObject, readYaml, readSpec, writeSpec } = require('./spec_io.cjs');

const HTTP_METHODS = new Set(['get', 'post', 'put', 'delete', 'patch', 'options', 'head']);

function loadConfig(configPath = path.join(__dirname, '..', 'connector-config.yaml')) {
  const config = readYaml(configPath);
  if (!Object.hasOwn(config, 'swaggerCleaner')) {
    throw new Error("Configuration file missing 'swaggerCleaner' section");
  }
  return config;
}

function operations(data) {
  return Object.values(data.paths || {}).flatMap(methods =>
    Object.entries(methods).filter(([method]) => HTTP_METHODS.has(method.toLowerCase()))
      .map(([, operation]) => operation));
}

function getEndpointName(endpoint) {
  const parts = endpoint.split('/').filter(Boolean);
  if (!parts.length) return 'Root';
  if (/^(v\d+|api|version\d+)$/i.test(parts[0])) {
    return parts.length > 1 ? parts[1].split('.')[0] : 'API';
  }
  return parts[0].split('.')[0];
}

function mapValues(value, transform) {
  if (Array.isArray(value)) return value.map(item => mapValues(item, transform));
  if (!isObject(value)) return value;
  return transform(value);
}

function removeCompositions(value) {
  return mapValues(value, object => Object.fromEntries(Object.entries(object)
    .filter(([key]) => !['anyOf', 'oneOf'].includes(key))
    .map(([key, item]) => [key, removeCompositions(item)])));
}

function removeRefSiblings(value) {
  return mapValues(value, object => {
    if (Object.hasOwn(object, '$ref')) {
      return Object.fromEntries(Object.entries(object)
        .filter(([key]) => key === '$ref' || key.startsWith('x-')));
    }
    return Object.fromEntries(Object.entries(object)
      .map(([key, item]) => [key, removeRefSiblings(item)]));
  });
}

function findUsedModels(data) {
  const used = new Set();
  function visit(value) {
    if (Array.isArray(value)) {
      value.forEach(visit);
    } else if (isObject(value)) {
      const ref = value.$ref;
      if (typeof ref === 'string' && ref.startsWith('#/definitions/')) {
        const name = ref.slice('#/definitions/'.length).split('/')[0]
          .replaceAll('~1', '/').replaceAll('~0', '~');
        if (!used.has(name)) {
          used.add(name);
          if (Object.hasOwn(data.definitions || {}, name)) visit(data.definitions[name]);
        }
      }
      Object.values(value).forEach(visit);
    }
  }
  visit(Object.fromEntries(Object.entries(data).filter(([key]) => key !== 'definitions')));
  return used;
}

function fixInfo(data, config) {
  if (!data.info) return;
  const info = config.info || {};
  if (Object.hasOwn(data.info, 'title')) {
    let title = data.info.title;
    for (const word of info.titleRestrictedWords || ['api', 'connector']) {
      title = title.replace(new RegExp(`\\b${word}\\b`, 'gi'), '');
    }
    data.info.title = title.replace(/\s+/g, ' ').trim().replace(/[^a-zA-Z0-9]+$/, '');
  }
  if ((!data.info.description || data.info.description.length < 30) && info.description) {
    data.info.description = info.description;
  }
  if (!Object.hasOwn(data.info, 'contact') && Object.keys(info.contact || {}).length) {
    data.info.contact = info.contact;
  }
  delete data.info['x-ms-connector-metadata'];
  if (!Object.hasOwn(data, 'x-ms-connector-metadata') && config.connectorMetadata?.length) {
    data['x-ms-connector-metadata'] = config.connectorMetadata;
  }
}

function cleanSpec(input, config, log = console.log) {
  const data = structuredClone(input);
  const settings = config.swaggerCleaner;
  const keep = settings.endpointsToKeep || [];
  if (keep.length && data.paths) {
    data.paths = Object.fromEntries(Object.entries(data.paths).flatMap(([endpoint, methods]) => {
      const filtered = Object.fromEntries(Object.entries(methods).filter(([method]) =>
        !HTTP_METHODS.has(method.toLowerCase()) ||
        keep.includes(`${endpoint}/${method}`) || keep.includes(`${endpoint}/${method.toLowerCase()}`)));
      return Object.keys(filtered).length ? [[endpoint, filtered]] : [];
    }));
  }
  for (const operation of operations(data)) {
    if (operation.responses) {
      operation.responses = Object.fromEntries(Object.entries(operation.responses)
        .filter(([status]) => status.startsWith('2')));
    }
  }
  fixInfo(data, settings);
  const webhook = data.definitions?.WebhookRequest?.properties?.webhook;
  if (webhook) {
    if (webhook.properties && Object.hasOwn(webhook.properties, 'url')) {
      webhook.required ??= [];
      if (!webhook.required.includes('url')) webhook.required.push('url');
    }
    delete webhook.minProperties;
  }
  let removedSchemas = 0;
  let removedParameters = 0;
  const removals = settings.parametersToRemove || [];
  for (const operation of operations(data)) {
    for (const response of Object.values(operation.responses || {})) {
      if (isObject(response.schema) && (response.schema.$ref || '').includes('EmptySuccessResponse')) {
        delete response.schema;
        removedSchemas++;
      }
    }
    if (operation.parameters && removals.length) {
      const originalCount = operation.parameters.length;
      operation.parameters = operation.parameters.filter(parameter => !removals.some(removal =>
        (parameter.name || '').toLowerCase() === (removal.name || '').toLowerCase() &&
        (!removal.in || parameter.in === removal.in)));
      removedParameters += originalCount - operation.parameters.length;
      if (!operation.parameters.length) delete operation.parameters;
    }
  }
  if (removedSchemas) log(`Removed ${removedSchemas} EmptySuccessResponse schema reference(s)`);
  if (removedParameters) log(`Removed ${removedParameters} configured parameter(s) from endpoints`);

  if (data.definitions) {
    const used = findUsedModels(data);
    const removed = Object.keys(data.definitions).filter(name => !used.has(name));
    data.definitions = Object.fromEntries(Object.entries(data.definitions).filter(([name]) => used.has(name)));
    if (removed.length) log(`Removed ${removed.length} unused model(s): ${removed.sort().join(', ')}`);
  }
  for (const [endpoint, methods] of Object.entries(data.paths || {})) {
    const name = getEndpointName(endpoint);
    for (const [method, operation] of Object.entries(methods)) {
      if (!HTTP_METHODS.has(method.toLowerCase())) continue;
      if (!operation.description) {
        operation.description = `${name ? name[0].toUpperCase() + name.slice(1) : 'Root'} ${method.toUpperCase()}`;
      }
      if (operation.operationId) {
        operation.operationId = operation.operationId[0].toUpperCase() + operation.operationId.slice(1);
      }
      for (const parameter of operation.parameters || []) {
        if (!Object.hasOwn(parameter, 'x-ms-summary')) {
          parameter['x-ms-summary'] = (parameter.name ?? 'Parameter').replace(/[_-]/g, ' ')
            .split(/\s+/).filter(Boolean)
            .map(word => word[0].toUpperCase() + word.slice(1).toLowerCase()).join(' ');
        }
        if (!Object.hasOwn(parameter, 'description')) {
          parameter.description = parameter['x-ms-summary'] ?? parameter.name ?? 'Parameter';
        }
        if (parameter.in === 'path' && !Object.hasOwn(parameter, 'x-ms-url-encoding')) {
          parameter['x-ms-url-encoding'] = 'single';
        }
        if (['x-skipworkflows', 'x-skipwebhooks'].includes((parameter.name || '').toLowerCase())) {
          parameter['x-ms-visibility'] = 'advanced';
        }
      }
    }
  }
  return removeCompositions(removeRefSiblings(data));
}

function main(args) {
  if (!args.length || ['-h', '--help'].includes(args[0])) {
    throw new Error('Usage: node swagger_cleaner.cjs <input_file> [output_file]\n' +
      '       node swagger_cleaner.cjs --list-endpoints <input_file>\n' +
      'Configure endpoints to keep and other settings in connector-config.yaml');
  }
  if (args[0] === '--list-endpoints') {
    if (!args[1]) throw new Error('Input file required with --list-endpoints option');
    const data = readSpec(args[1]);
    console.log('Available endpoints:');
    const endpoints = Object.entries(data.paths || {}).flatMap(([endpoint, methods]) =>
      Object.keys(methods).filter(method => HTTP_METHODS.has(method.toLowerCase()))
        .map(method => `${endpoint}/${method.toLowerCase()}`));
    for (const endpoint of endpoints.sort()) console.log(`  "${endpoint}",`);
    return;
  }
  const [input, output = path.join(path.dirname(input),
    path.basename(input, path.extname(input)) + '-cleaned' + path.extname(input))] = args;
  const config = loadConfig();
  const data = cleanSpec(readSpec(input), config);
  writeSpec(output, data, input);
  console.log(`Successfully processed ${input} -> ${output}`);
  const keep = config.swaggerCleaner.endpointsToKeep || [];
  if (keep.length) {
    const count = operations(data).length;
    console.log(`Filtered to ${count} endpoints out of ${keep.length} specified`);
    if (count < keep.length) {
      console.log('Warning: Some specified endpoints were not found in the input file.');
      console.log('Use --list-endpoints to see available endpoints.');
    }
  } else {
    console.log('All endpoints kept');
  }
  console.log('Added descriptions and capitalized operationIds');
}

module.exports = { cleanSpec, findUsedModels, getEndpointName, loadConfig };

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(`Error processing specification: ${error.message}`);
    process.exitCode = 1;
  }
}
