'use strict';

function localSchemaFiles(document) {
  const files = new Set();
  const visited = new WeakSet();
  function visit(value) {
    if (!value || typeof value !== 'object' || visited.has(value)) return;
    visited.add(value);
    if (Object.hasOwn(value, '$ref')) {
      const reference = value.$ref;
      if (typeof reference !== 'string' || reference.trim() !== reference) {
        throw new Error(`Invalid schema reference: ${JSON.stringify(reference)}`);
      }
      if (reference && !reference.startsWith('#')) {
        const file = decodeURIComponent(reference.split('#')[0]);
        if (!file || /^[a-z][a-z0-9+.-]*:/i.test(file) || /^[\\/]/.test(file) ||
            file.includes('\\') || file.includes('?') || /[\u0000-\u001f]/.test(file)) {
          throw new Error(`Only local relative schema references are supported: ${reference}`);
        }
        files.add(file);
      }
    }
    for (const child of Object.values(value)) visit(child);
  }
  visit(document);
  return [...files];
}

module.exports = { localSchemaFiles };
