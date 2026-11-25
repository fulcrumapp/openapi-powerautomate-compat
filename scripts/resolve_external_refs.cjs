'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const refs = require('json-refs');
const yaml = require('js-yaml');
const { localSchemaFiles } = require('./schema_refs.cjs');

async function main() {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) {
    throw new Error('Usage: node resolve_external_refs.cjs <input> <output>');
  }
  const inputPath = path.resolve(input);
  const root = path.dirname(inputPath);
  const result = await refs.resolveRefsAt(inputPath, {
    filter: ['relative'],
    loaderOptions: {
      prepareRequest(request, callback) {
        callback(new Error('Remote schema requests are not supported'));
      },
      processContent(response, callback) {
        try {
          const currentFile = path.resolve(response.location || inputPath);
          const document = yaml.load(response.text);
          for (const reference of localSchemaFiles(document)) {
            const target = path.resolve(path.dirname(currentFile), reference);
            const relative = path.relative(root, target);
            if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
              throw new Error(`Schema reference leaves the specification directory: ${reference}`);
            }
          }
          callback(null, document);
        } catch (error) {
          callback(error);
        }
      },
    },
  });
  for (const [location, reference] of Object.entries(result.refs)) {
    if (reference.error || reference.missing || reference.circular) {
      throw new Error(`Cannot resolve ${location}: ${reference.error || reference.uri}`);
    }
  }
  await fs.writeFile(output, JSON.stringify(result.resolved, null, 2) + '\n');
}

main().catch(error => {
  console.error(`Error resolving external schemas: ${error.message}`);
  process.exitCode = 1;
});
