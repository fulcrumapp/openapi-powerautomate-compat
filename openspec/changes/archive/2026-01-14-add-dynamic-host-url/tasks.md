# Implementation Tasks: Add Dynamic Host URL Configuration

## Task List

### Configuration Updates

- [x] **Task 1.1**: Update `connector-config.yaml`
  - Add `connectionParameters` section with `hostUrl` parameter
  - Configure UI definition with display name, description, tooltip, and constraints
  - Set default value to `api.fulcrumapp.com`
  - Add URL format validation pattern
  - **Estimate**: 15 minutes
  - **Validation**: YAML file parses correctly, all required fields present

- [x] **Task 1.2**: Update `connector-config.yaml` with policy template configuration
  - Add `policyTemplates` section
  - Configure `dynamichosturl` policy template instance
  - Set URL template to use connection parameter: `https://@connectionParameters('hostUrl')`
  - Configure operations scope (apply to all operations by omitting operations list)
  - **Estimate**: 10 minutes
  - **Validation**: Policy template configuration is valid per Microsoft schema

### Certification Packager Updates

- [x] **Task 2.1**: Extend `certification_packager.py` to support connection parameters
  - Update `generate_api_properties()` to read `connectionParameters` from config
  - Merge configured connection parameters with authentication parameters
  - Preserve existing parameter order (authentication parameters first)
  - **Estimate**: 20 minutes
  - **Validation**: Generated `apiProperties.json` contains both auth and host parameters

- [x] **Task 2.2**: Add policy templates support to `certification_packager.py`
  - Update `generate_api_properties()` to read `policyTemplates` from config
  - Generate `policyTemplateInstances` array in output
  - Support both `dynamichosturl` and future policy template types
  - **Estimate**: 25 minutes
  - **Validation**: Generated `apiProperties.json` contains policy template instances

- [x] **Task 2.3**: Update configuration validation
  - Update `validate_config()` to optionally accept `connectionParameters`
  - Update `validate_config()` to optionally accept `policyTemplates`
  - Validate policy template structure if present (templateId, parameters)
  - **Estimate**: 15 minutes
  - **Validation**: Invalid configurations are caught and reported clearly

### Documentation Updates

- [x] **Task 3.1**: Update README.md generation
  - Add section for custom host URL configuration in "Getting Started"
  - Include examples: regional endpoints (Canada, Australia, Europe), custom domains
  - Document URL format requirements
  - Add troubleshooting tips for connection issues
  - **Estimate**: 20 minutes
  - **Validation**: Generated README contains host URL guidance

- [x] **Task 3.2**: Update connector-config.yaml template/comments
  - Add inline comments explaining connection parameters
  - Add inline comments explaining policy templates
  - Add examples for common use cases
  - **Estimate**: 10 minutes
  - **Validation**: Configuration file is self-documenting

### Testing and Validation

- [x] **Task 4.1**: Update validation script
  - Add check for connection parameters in apiProperties.json
  - Add check for policy templates in apiProperties.json
  - Verify dynamichosturl template structure
  - **Estimate**: 20 minutes
  - **Validation**: `./scripts/validate.sh` passes with new checks

- [x] **Task 4.2**: Test certification package generation
  - Run `./scripts/convert_openapi.sh` with updated configuration
  - Verify `apiProperties.json` contains hostUrl parameter
  - Verify `apiProperties.json` contains dynamichosturl policy
  - Verify README contains host URL documentation
  - **Estimate**: 15 minutes
  - **Validation**: All three certification files generate correctly

- [x] **Task 4.3**: Manual testing documentation
  - Document how to test the dynamic host URL in Power Automate
  - Create test checklist for connection creation with custom URL
  - Document expected behavior when URL is invalid
  - **Estimate**: 15 minutes
  - **Validation**: Testing instructions are clear and complete

## Task Dependencies

```
1.1 (Update config with connection parameter)
  └─> 1.2 (Update config with policy template)
       └─> 2.1 (Support connection parameters in packager)
            └─> 2.2 (Support policy templates in packager)
                 └─> 2.3 (Update validation)
                      ├─> 3.1 (Update README generation)
                      ├─> 3.2 (Update config comments)
                      └─> 4.1 (Update validation script)
                           └─> 4.2 (Test package generation)
                                └─> 4.3 (Document manual testing)
```

## Parallelizable Work

The following tasks can be done in parallel after Task 2.3 completes:
- Task 3.1 and Task 3.2 (Documentation)
- Task 4.1 (Validation script updates)

## Rollback Plan

If issues are discovered:
1. Revert changes to `connector-config.yaml`
2. Revert changes to `certification_packager.py`
3. Revert changes to validation script
4. Re-run conversion pipeline to regenerate clean certification package

## Definition of Done

- [x] All tasks marked complete
- [x] `./scripts/validate.sh` passes with zero warnings (note: pre-existing "Supported Operations" section issue documented)
- [x] Certification package contains host URL parameter
- [x] Certification package contains dynamichosturl policy
- [x] README documents how to use custom host URLs
- [x] Code changes follow project conventions (type hints, docstrings, error handling)
- [x] No breaking changes to existing configuration or behavior
