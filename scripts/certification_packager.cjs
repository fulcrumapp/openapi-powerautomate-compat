'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { isObject, readYaml } = require('./spec_io.cjs');

function validateConfig(config) {
  const required = ['publisher', 'displayName', 'iconBrandColor', 'supportEmail',
    'prerequisites', 'knownLimitations', 'version'];
  const missing = required.filter(field => !config[field] ||
    (Array.isArray(config[field]) && !config[field].length) ||
    (isObject(config[field]) && !Object.keys(config[field]).length));
  if (missing.length) {
    throw new Error(`Missing required fields in connector-config.yaml: ${missing.join(', ')}`);
  }
  for (const [name, parameter] of Object.entries(config.connectionParameters || {})) {
    for (const field of ['type', 'uiDefinition']) {
      if (!Object.hasOwn(parameter, field)) throw new Error(`Connection parameter '${name}' missing '${field}'`);
    }
  }
  for (const template of config.policyTemplates || []) {
    for (const field of ['templateId', 'parameters']) {
      if (!Object.hasOwn(template, field)) throw new Error(`Policy template missing '${field}'`);
    }
  }
}

function generateApiProperties(config) {
  const parameters = Object.fromEntries(Object.entries(config.connectionParameters || {})
    .map(([name, parameter]) => {
      const uiDefinition = structuredClone(parameter.uiDefinition);
      if (Object.hasOwn(parameter, 'default')) {
        uiDefinition.constraints ??= {};
        uiDefinition.constraints.default = parameter.default;
      }
      return [name, { type: parameter.type, uiDefinition }];
    }));
  return {
    properties: {
      connectionParameters: parameters,
      iconBrandColor: config.iconBrandColor,
      capabilities: [],
      policyTemplateInstances: (config.policyTemplates || []).map(template => ({
        templateId: template.templateId,
        title: Object.hasOwn(template, 'title') ? template.title : template.templateId,
        parameters: template.parameters,
      })),
    },
  };
}

function extractOperations(spec) {
  const result = { triggers: [], actions: [] };
  for (const methods of Object.values(spec.paths || {})) {
    for (const [method, operation] of Object.entries(methods)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method.toLowerCase()) || !isObject(operation)) continue;
      const info = {
        id: operation.operationId ?? 'Unknown',
        summary: operation.summary ?? 'No description available',
        description: operation.description ?? '',
      };
      if (operation['x-ms-trigger'] != null) {
        result.triggers.push(info);
      } else if (operation['x-ms-visibility'] !== 'internal') {
        result.actions.push(info);
      }
    }
  }
  return result;
}

function generateReadme(config, spec) {
  const name = config.displayName ?? 'Fulcrum';
  const description = (config.swaggerCleaner?.info?.description || '').trim();
  const lines = [`# ${name}`, '', description ||
    `The ${name} connector enables integration with the ${name} platform for Power Automate and Power Apps.`, '',
  '## Publisher', '', config.publisher, '', '## Prerequisites', '',
  ...config.prerequisites.map(item => `- ${item}`), '', '## Supported Operations', ''];
  const operations = extractOperations(spec);
  for (const [key, heading] of [['triggers', 'Triggers'], ['actions', 'Actions']]) {
    if (!operations[key].length) continue;
    lines.push(`### ${heading}`, '');
    for (const operation of operations[key]) {
      lines.push(`#### ${operation.summary}`);
      if (operation.description) lines.push(operation.description);
      lines.push('');
    }
  }
  lines.push('## Obtaining Credentials', '');
  if (Object.hasOwn(config, 'authentication')) {
    lines.push(config.authentication.description ?? '', '');
    if (Object.hasOwn(config.authentication, 'tooltip')) lines.push(config.authentication.tooltip, '');
  } else if (Object.hasOwn(config, 'obtainingCredentials')) {
    lines.push(config.obtainingCredentials.trim(), '');
  } else if (Object.hasOwn(config.connectionParameters || {}, 'api_key')) {
    lines.push(config.connectionParameters.api_key.uiDefinition?.tooltip ||
      'You will need an API token to authenticate with this connector.', '');
  } else {
    lines.push('Contact the service provider to obtain the necessary credentials.', '');
  }
  if (config.gettingStarted) {
    lines.push('## Getting Started', '', config.gettingStarted.trim(), '');
    if (Object.hasOwn(config.connectionParameters || {}, 'hostUrl')) {
      lines.push('### Custom Host URLs', '',
        'By default, the connector uses the production Fulcrum API at `api.fulcrumapp.com`. ' +
        'For other regions, you can specify a different host URL when creating your connection.', '',
        '**Regional Endpoints:**',
        '- United States (default): `api.fulcrumapp.com`',
        '- Canada: `api.fulcrumapp-ca.com`',
        '- Australia: `api.fulcrumapp-au.com`',
        '- Europe: `api.fulcrumapp-eu.com`', '',
        '**Format:** Enter only the hostname without protocol or path. The connector will ' +
        'automatically use HTTPS and the correct API path.', '',
        '**Troubleshooting:**',
        '- Ensure your custom host is accessible from your network',
        '- Verify the hostname is correct (no typos)',
        '- Confirm your API token is valid for the specified host', '');
    }
  }
  lines.push('## Known Issues and Limitations', '');
  if (config.knownLimitations?.length) {
    lines.push(...config.knownLimitations.map(item => `- ${item}`));
  } else {
    lines.push('No known issues or limitations at this time.');
  }
  lines.push('');
  if (config.faqs?.length) {
    lines.push('## Frequently Asked Questions', '');
    for (const faq of config.faqs) {
      if (!faq.question) continue;
      lines.push(`### ${faq.question}`);
      if (faq.answer) lines.push(faq.answer);
      lines.push('');
    }
  }
  lines.push('## Deployment Instructions', '',
    config.deploymentInstructions ? config.deploymentInstructions.trim() :
      'Please use [these instructions](https://learn.microsoft.com/en-us/connectors/custom-connectors/paconn-cli) to deploy this connector as a custom connector in Microsoft Power Automate and Power Apps.', '');
  return lines.join('\n');
}

function packageConnector(spec, config, outputDir, log = console.log) {
  validateConfig(config);
  const definition = structuredClone(spec);
  if (definition.info) {
    definition.info.title = config.displayName;
    definition.info.version = config.version;
  }
  // Render everything before writing so invalid configuration cannot leave a partial package.
  const files = {
    'apiDefinition.swagger.json': JSON.stringify(definition, null, 2) + '\n',
    'apiProperties.json': JSON.stringify(generateApiProperties(config), null, 2) + '\n',
    'README.md': generateReadme(config, definition),
  };
  fs.mkdirSync(outputDir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    const output = path.join(outputDir, name);
    fs.writeFileSync(output, content);
    log(`Generated: ${output}`);
  }
}

module.exports = { validateConfig, generateApiProperties, extractOperations, generateReadme, packageConnector };

if (require.main === module) {
  try {
    if (process.argv.length !== 5) {
      throw new Error('Usage: node certification_packager.cjs <swagger_yaml_path> <config_yaml_path> <output_dir>');
    }
    const [input, configPath, output] = process.argv.slice(2);
    console.log(`Loading configuration from ${configPath}...`);
    const config = readYaml(configPath);
    validateConfig(config);
    console.log(`Loading Swagger specification from ${input}...`);
    packageConnector(readYaml(input), config, output);
    console.log(`Certification package generated successfully in ${output}`);
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 1;
  }
}
