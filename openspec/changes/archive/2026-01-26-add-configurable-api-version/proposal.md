# Change: Add Configurable API Version

## Why

The API version in the packaged connector (`apiDefinition.swagger.json`) is currently hardcoded from the source specification. Users need the ability to control the version number displayed in Power Automate to match their connector versioning strategy, especially when iterating on connector improvements without changing the underlying API version.

## What Changes

- Add required `version` field to `connector-config.yaml` for explicit version configuration
- Update `certification_packager.py` to override `info.version` with the configured value
- Document the version configuration feature in README.md

## Impact

- Affected specs: conversion-pipeline
- Affected code: 
  - `scripts/certification_packager.py` - Add version override logic
  - `connector-config.yaml` - Add required `version` field
  - `README.md` - Document version configuration
- Breaking change: `version` field is now required in `connector-config.yaml`
