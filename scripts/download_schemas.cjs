'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const yaml = require('js-yaml');
const { localSchemaFiles } = require('./schema_refs.cjs');

async function downloadSchemas(input, source) {
  const root = path.dirname(path.resolve(input));
  const base = new URL('.', source);
  const visited = new Set();
  let count = 0;
  async function visit(file) {
    if (visited.has(file)) return;
    visited.add(file);
    const document = yaml.load(await fs.readFile(file, 'utf8'));
    for (const reference of localSchemaFiles(document)) {
      const target = path.resolve(path.dirname(file), reference);
      const relative = path.relative(root, target);
      if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        throw new Error(`Schema reference leaves the specification directory: ${reference}`);
      }
      if (!visited.has(target)) {
        const url = new URL(relative.split(path.sep).map(encodeURIComponent).join('/'), base);
        const response = await fetch(url, { redirect: 'error' });
        if (!response.ok) {
          throw new Error(`Failed to download ${relative}: HTTP ${response.status}`);
        }
        const content = await response.text();
        localSchemaFiles(yaml.load(content));
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, content);
        count += 1;
        console.log(`  Downloaded ${relative}`);
        await visit(target);
      }
    }
  }
  await visit(path.resolve(input));
  console.log(`Downloaded ${count} external schema file(s)`);
}

if (require.main === module) {
  const [input, source] = process.argv.slice(2);
  if (!input || !source) {
    console.error('Usage: node download_schemas.cjs <input> <source-url>');
    process.exitCode = 1;
  } else {
    downloadSchemas(input, source).catch(error => {
      console.error(`Error downloading schemas: ${error.message}`);
      process.exitCode = 1;
    });
  }
}

module.exports = { downloadSchemas };
