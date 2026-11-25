'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readYaml(file) {
  const data = yaml.load(fs.readFileSync(file, 'utf8'));
  if (!isObject(data)) throw new Error(`Expected an object in ${file}`);
  return data;
}

function isYaml(file) {
  return ['.yaml', '.yml'].includes(path.extname(file).toLowerCase());
}

function readSpec(file) {
  if (isYaml(file)) return readYaml(file);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!isObject(data)) throw new Error(`Expected an object in ${file}`);
  return data;
}

function writeSpec(file, data, inputFile = file) {
  // The input format controls output, including when a different output suffix is supplied.
  fs.writeFileSync(file, isYaml(inputFile)
    ? yaml.dump(data, { noRefs: true, lineWidth: 80 })
    : JSON.stringify(data, null, 2) + '\n');
}

module.exports = { isObject, readYaml, readSpec, writeSpec };

if (require.main === module) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node spec_io.cjs <input_file>');
    readSpec(process.argv[2]);
  } catch (error) {
    console.error(`Error reading specification: ${error.message}`);
    process.exitCode = 1;
  }
}
