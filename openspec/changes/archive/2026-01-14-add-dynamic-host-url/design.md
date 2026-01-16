# Design Document: Add Dynamic Host URL Configuration

## Overview

This design document outlines the technical approach for adding dynamic host URL configuration to the Fulcrum Power Automate connector using Microsoft's `dynamichosturl` policy template.

## Architecture

### Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ connector-config.yaml                                         │
│ ┌─────────────────────────┐  ┌──────────────────────────┐  │
│ │ connectionParameters:    │  │ policyTemplates:          │  │
│ │   hostUrl:              │  │   - templateId:           │  │
│ │     type: string        │  │     dynamichosturl       │  │
│ │     default: api...     │  │     parameters:           │  │
│ │     uiDefinition: {...} │  │       urlTemplate: ...   │  │
│ └─────────────────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ (read by)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ certification_packager.py                                     │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ generate_api_properties()                                │ │
│ │ ├─ Read connectionParameters from config                │ │
│ │ ├─ Merge with authentication parameters                 │ │
│ │ ├─ Read policyTemplates from config                     │ │
│ │ └─ Generate policyTemplateInstances array               │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ (generates)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ apiProperties.json                                           │
│ {                                                            │
│   "properties": {                                            │
│     "connectionParameters": {                                │
│       "x-apitoken": { type: "securestring", ... },         │
│       "hostUrl": { type: "string", default: "api...", ... } │
│     },                                                       │
│     "policyTemplateInstances": [                            │
│       {                                                      │
│         "templateId": "dynamichosturl",                     │
│         "parameters": {                                      │
│           "x-ms-apimTemplateParameter.urlTemplate":         │
│             "https://@connectionParameters('hostUrl')"      │
│         }                                                    │
│       }                                                      │
│     ]                                                        │
│   }                                                          │
│ }                                                            │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ (used by)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Microsoft Power Platform Runtime                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 1. User creates connection, enters hostUrl               │ │
│ │ 2. User adds action/trigger to flow                      │ │
│ │ 3. Policy template evaluates:                            │ │
│ │    https://@connectionParameters('hostUrl')              │ │
│ │ 4. Replaces swagger host with evaluated URL              │ │
│ │ 5. Makes API request to user-specified host              │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Configuration Time** (Developer):
   - Developer adds connection parameter and policy template config to `connector-config.yaml`
   - Configuration defines UI elements, default values, and policy behavior

2. **Build Time** (Certification Packager):
   - `certification_packager.py` reads configuration
   - Generates `apiProperties.json` with merged connection parameters
   - Adds policy template instance to `policyTemplateInstances` array

3. **Connection Time** (End User):
   - User creates new connection in Power Automate/Power Apps
   - UI displays "Host URL" field with default value and tooltip
   - User can accept default or enter custom URL (e.g., `api.fulcrumapp-ca.com`)
   - Connection is saved with user-provided or default value

4. **Runtime** (Flow Execution):
   - User's flow triggers an action/trigger using the connection
   - Power Platform runtime evaluates policy template expression
   - Expression `@connectionParameters('hostUrl')` resolves to user's value
   - Final URL `https://[user-value]` replaces the static swagger host
   - API request is made to dynamically constructed URL

## Design Decisions

### Decision 1: Configuration Structure

**Options Considered:**
1. Add connection parameters directly to `authentication` section
2. Create separate top-level `connectionParameters` section
3. Embed policy templates with authentication config

**Chosen:** Option 2 - Separate `connectionParameters` section

**Rationale:**
- Clear separation of concerns: authentication vs connection configuration
- Follows Alkymi connector pattern (proven reference implementation)
- Allows multiple connection parameters in the future (e.g., basePath, timeout)
- Easier to document and maintain
- More flexible for future extensions

### Decision 2: Default Host URL

**Options Considered:**
1. No default - require users to always specify
2. Default to production: `api.fulcrumapp.com`
3. Multiple predefined options in dropdown

**Chosen:** Option 2 - Default to production

**Rationale:**
- Maintains backward compatibility for existing users
- Most common use case (production) requires no configuration
- Reduces friction for new users
- Still allows advanced users to customize
- Simpler UX than dropdown with custom option

### Decision 3: Policy Template Scope

**Options Considered:**
1. Apply to all operations (omit `x-ms-apimTemplate-operationName`)
2. Apply only to specific operations (list operation IDs)
3. Provide configuration option to choose scope

**Chosen:** Option 1 - Apply to all operations

**Rationale:**
- All Fulcrum API operations use the same host
- Simpler configuration and mental model
- Avoids maintenance burden of listing all operation IDs
- Consistent behavior across all connector actions/triggers
- Matches expected behavior: if user sets host, it should apply everywhere

### Decision 4: URL Template Expression

**Options Considered:**
1. `https://@connectionParameters('hostUrl')`
2. `https://@connectionParameters('hostUrl')/api` (include basePath)
3. `@connectionParameters('hostUrl')` (allow user to specify full URL with protocol)

**Chosen:** Option 1 - Protocol + host parameter

**Rationale:**
- BasePath (`/api`) is part of swagger spec, shouldn't be duplicated
- Forces HTTPS for security (Fulcrum API requires HTTPS)
- User only needs to enter hostname, not full URL
- Reduces user error (forgetting protocol, incorrect basePath)
- Matches Alkymi connector pattern

### Decision 5: URL Validation

**Options Considered:**
1. No validation - accept any string
2. Client-side regex validation in uiDefinition
3. Server-side validation in certification packager
4. Both client and server validation

**Chosen:** Option 2 - Client-side regex validation

**Rationale:**
- Provides immediate feedback to users during connection creation
- No additional backend validation infrastructure needed
- Power Platform UI supports constraints/validation patterns
- Balance between UX and complexity
- Server-side validation would delay error feedback until API call

**Validation Pattern:** `^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$`
- Validates hostname format (no protocol, no path)
- Allows subdomains
- Prevents common mistakes

### Decision 6: Static Host Field Handling

**Options Considered:**
1. Remove `host` from swagger spec entirely
2. Set `host` to empty string
3. Keep `host: api.fulcrumapp.com` as fallback
4. Set `host` to placeholder value

**Chosen:** Option 3 - Keep current host as fallback

**Rationale:**
- Swagger 2.0 spec requires `host` field (schema validation)
- Acts as fallback if policy template fails to apply
- Documents the default/expected endpoint
- No code changes needed to swagger generation
- Safer approach - graceful degradation

## Implementation Details

### Configuration Schema

```yaml
# connector-config.yaml additions

# Connection parameters (new section)
connectionParameters:
  hostUrl:
    type: string
    default: api.fulcrumapp.com
    uiDefinition:
      displayName: Host URL
      description: The API host for your Fulcrum instance
      tooltip: "Default: api.fulcrumapp.com. For other regions use: api.fulcrumapp-ca.com (Canada), api.fulcrumapp-au.com (Australia), api.fulcrumapp-eu.com (Europe)"
      constraints:
        required: false
        clearText: true
        tabIndex: 2

# Policy templates (new section)
policyTemplates:
  - templateId: dynamichosturl
    title: Set API Host URL
    parameters:
      x-ms-apimTemplateParameter.urlTemplate: "https://@connectionParameters('hostUrl')"
```

### Code Changes

#### certification_packager.py

**Function: `generate_api_properties()` (MODIFIED)**

```python
def generate_api_properties(config: Dict[str, Any], output_path: str) -> None:
    """Generate apiProperties.json with connection parameters and metadata."""
    
    auth = config['authentication']
    
    # Build connection parameters - start with authentication
    connection_parameters = {}
    
    if auth['type'] == 'apiKey':
        param_name = auth.get('parameterName', 'api_key')
        connection_parameters[param_name] = {
            "type": "securestring",
            "uiDefinition": {
                "displayName": auth['displayName'],
                "description": auth['description'],
                "tooltip": auth.get('tooltip', auth['description']),
                "constraints": {
                    "required": "true"
                }
            }
        }
    
    # Add additional connection parameters from config (NEW)
    if 'connectionParameters' in config:
        for param_name, param_config in config['connectionParameters'].items():
            connection_parameters[param_name] = {
                "type": param_config['type'],
                "uiDefinition": param_config['uiDefinition']
            }
            # Add default value if specified
            if 'default' in param_config:
                connection_parameters[param_name]['uiDefinition']['constraints'] = \
                    connection_parameters[param_name]['uiDefinition'].get('constraints', {})
                connection_parameters[param_name]['uiDefinition']['constraints']['default'] = \
                    param_config['default']
    
    # Build policy template instances (NEW)
    policy_template_instances = []
    if 'policyTemplates' in config:
        for template_config in config['policyTemplates']:
            policy_instance = {
                "templateId": template_config['templateId'],
                "title": template_config.get('title', template_config['templateId']),
                "parameters": template_config['parameters']
            }
            policy_template_instances.append(policy_instance)
    
    api_properties = {
        "properties": {
            "connectionParameters": connection_parameters,
            "iconBrandColor": config['iconBrandColor'],
            "capabilities": [],
            "policyTemplateInstances": policy_template_instances  # MODIFIED
        }
    }
    
    # ... write to file (unchanged) ...
```

**Function: `validate_config()` (MODIFIED)**

```python
def validate_config(config: Dict[str, Any]) -> None:
    """Validate that the configuration contains all required fields."""
    
    # ... existing validation (unchanged) ...
    
    # Validate connection parameters if present (NEW)
    if 'connectionParameters' in config:
        for param_name, param_config in config['connectionParameters'].items():
            if 'type' not in param_config:
                print(f"ERROR: Connection parameter '{param_name}' missing 'type'", 
                      file=sys.stderr)
                sys.exit(1)
            if 'uiDefinition' not in param_config:
                print(f"ERROR: Connection parameter '{param_name}' missing 'uiDefinition'",
                      file=sys.stderr)
                sys.exit(1)
    
    # Validate policy templates if present (NEW)
    if 'policyTemplates' in config:
        for template in config['policyTemplates']:
            if 'templateId' not in template:
                print(f"ERROR: Policy template missing 'templateId'", file=sys.stderr)
                sys.exit(1)
            if 'parameters' not in template:
                print(f"ERROR: Policy template missing 'parameters'", file=sys.stderr)
                sys.exit(1)
```

### Testing Strategy

#### Unit-Level Testing (via validation script)

1. **Configuration Validation**
   - Test config with connection parameters parses correctly
   - Test config with policy templates parses correctly
   - Test missing required fields triggers validation error
   - Test invalid parameter types trigger validation error

2. **apiProperties.json Validation**
   - Verify JSON is well-formed
   - Verify connectionParameters contains both auth and hostUrl
   - Verify policyTemplateInstances array is present
   - Verify policyTemplateInstances contains dynamichosturl template
   - Verify urlTemplate expression is correct

#### Integration Testing (manual)

1. **Package Generation**
   - Run full conversion pipeline
   - Verify all three certification files generated
   - Verify no regressions in existing functionality

2. **Power Platform Import** (external)
   - Import connector into Power Automate (out of scope for this change)
   - Create connection with default host URL
   - Create connection with custom host URL
   - Verify both connections work correctly

## Error Handling

### Configuration Errors

**Scenario:** Missing or invalid connection parameter configuration

**Handling:**
- Validate during `validate_config()`
- Print clear error message indicating which field is missing
- Exit with non-zero status code
- Pipeline stops due to `set -e`

**Example Error Message:**
```
ERROR: Connection parameter 'hostUrl' missing 'uiDefinition'
```

### Policy Template Errors

**Scenario:** Invalid policy template configuration

**Handling:**
- Validate template structure during `validate_config()`
- Verify required fields: `templateId`, `parameters`
- Exit with clear error message

**Example Error Message:**
```
ERROR: Policy template missing 'templateId'
```

### Runtime Errors (Power Platform)

**Scenario:** User enters invalid host URL

**Handling:**
- UI validation provides immediate feedback (regex)
- Power Platform shows connection error if hostname doesn't resolve
- API returns error if host exists but isn't a valid Fulcrum API
- User can edit connection to fix URL

## Backward Compatibility

### Existing Connections

**Impact:** None

**Rationale:**
- This is a new connector, not an update to existing connector
- First-time deployment will include this feature from the start

### Configuration Compatibility

**Impact:** None to existing code

**Changes:**
- `connector-config.yaml` gains new optional sections
- `certification_packager.py` handles absence of new sections gracefully
- If no `connectionParameters` or `policyTemplates` in config, behavior is unchanged

### Future Compatibility

**Extensibility:**
- Connection parameters structure supports adding more parameters in future
- Policy templates array supports adding more policies in future
- Clear separation of concerns enables independent evolution

## Security Considerations

### URL Injection

**Risk:** User could specify malicious URL to redirect API calls

**Mitigation:**
- HTTPS enforced in URL template (no HTTP allowed)
- Hostname validation via regex prevents most injection attacks
- User's own API token is used - they can only attack themselves
- Power Platform provides additional runtime security validation

### Credential Leakage

**Risk:** Custom host URL could expose API token to unauthorized server

**Mitigation:**
- User is responsible for host URL security (documented in README)
- API token remains secure string (not exposed in logs)
- Standard HTTPS transport security applies
- Document best practices in README

### Default Host Security

**Risk:** Hardcoded default might become outdated or compromised

**Mitigation:**
- Default is configurable in `connector-config.yaml` without code changes
- Can be updated via configuration update, not code change
- Clear documentation of default value

## Performance Impact

**Expected Impact:** Negligible

**Analysis:**
- Policy template evaluation happens once per API call
- String substitution is fast (microseconds)
- No network calls or complex computation
- No caching needed

**Measurement:**
- Not measurable at this level (Power Platform internals)
- No performance testing needed for this change

## Documentation Updates

### README.md Updates

**New Section: "Custom Host URLs"**

```markdown
### Custom Host URLs

By default, the connector uses the production Fulcrum API at `api.fulcrumapp.com`. 
For other regions or custom deployments, you can specify a different host URL 
when creating your connection.

**Regional Endpoints:**
- United States (default): `api.fulcrumapp.com`
- Canada: `api.fulcrumapp-ca.com`
- Australia: `api.fulcrumapp-au.com`
- Europe: `api.fulcrumapp-eu.com`

**Format:** Enter only the hostname without protocol or path. The connector will 
automatically use HTTPS and the correct API path.

**Troubleshooting:**
- Ensure your custom host is accessible from your network
- Verify the hostname is correct (no typos)
- Confirm your API token is valid for the specified host
```

### connector-config.yaml Comments

Add inline documentation explaining:
- Purpose of connectionParameters section
- Purpose of policyTemplates section
- How to add additional parameters
- Examples of common customizations

## Alternatives Analysis

### Why Not Query Parameters?

**Considered:** Allow users to specify host via query parameter in each action

**Rejected:**
- Violates REST principles (host is connection-level, not operation-level)
- Poor UX - repetitive configuration
- Error-prone - inconsistent hosts in same flow
- Not the Power Platform pattern for this use case

### Why Not Environment Variables?

**Considered:** Use Power Platform environment variables

**Rejected:**
- Requires admin-level access to set environment variables
- Not connection-specific (affects all connections in environment)
- Adds complexity for simple use case
- Connection parameters are the standard approach

### Why Not Multiple Connectors?

**Considered:** Deploy separate connector packages per environment

**Rejected:**
- Maintenance burden of multiple nearly-identical connectors
- Discovery problem - users must find the right connector
- Cannot support arbitrary custom domains
- Violates DRY principle

## Future Enhancements

### Potential Future Work (Out of Scope)

1. **BasePath Customization**
   - Allow users to specify custom API basePath
   - Currently hardcoded to `/api`
   - Would require separate connection parameter and URL template modification

2. **Connection String Format**
   - Accept full URL format: `https://hostname/path`
   - More flexible but more error-prone
   - Would need enhanced validation

3. **Predefined Environment Dropdown**
   - Dropdown with "US (default)", "Canada", "Australia", "Europe", "Custom"
   - Shows/hides custom URL input based on selection
   - Better UX but more complex configuration

4. **Connection Testing**
   - Test connection button that validates host URL
   - Makes test API call during connection creation
   - Requires additional connector logic

5. **Multiple Host Support**
   - Support multiple hosts in one connection
   - Round-robin or failover logic
   - Requires policy template enhancements

## Open Questions

1. **Should default value be required or optional field in config?**
   - Recommendation: Optional - allow flexibility for other connection parameters

2. **Should we validate that default value matches the static swagger host?**
   - Recommendation: No - allow them to diverge intentionally

3. **Should validation regex be configurable or hardcoded?**
   - Recommendation: Hardcoded initially, make configurable if needed

4. **Should we support path substitution in URL template?**
   - Recommendation: No - keep basePath in swagger spec, only host is dynamic

## References

- [Microsoft Power Platform: Dynamic Host URL Policy](https://learn.microsoft.com/en-us/connectors/custom-connectors/policy-templates/dynamichosturl/dynamichosturl)
- [Alkymi Connector Reference Implementation](https://github.com/microsoft/PowerPlatformConnectors/blob/dev/certified-connectors/Alkymi/apiProperties.json)
- [Power Platform Certified Connector Schema](https://github.com/microsoft/PowerPlatformConnectors/blob/dev/templates/certified-connectors/readme.md)
- Project docs: `openspec/project.md`
- Existing spec: `openspec/specs/conversion-pipeline/spec.md`
