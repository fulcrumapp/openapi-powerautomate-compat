# Proposal: Add Dynamic Host URL Configuration

## Change ID
`add-dynamic-host-url`

## Problem Statement

Power Platform users need to configure custom API host URLs when connecting to different Fulcrum regional deployments. Currently, the connector hardcodes `host: api.fulcrumapp.com` in the Swagger specification, preventing users from connecting to regional Fulcrum API endpoints.

This limitation affects:
- **Regional Deployments**: Users in Canada, Australia, or Europe cannot connect to their regional API endpoints
- **Multi-Region Organizations**: Organizations with data in multiple regions need separate connectors for each region
- **Custom Deployments**: Organizations with custom Fulcrum domains cannot use the connector
- **Development/Testing**: Users cannot connect to regional or testing API environments

## Proposed Solution

Add dynamic host URL configuration using Microsoft Power Platform's connection parameters and the `dynamichosturl` policy template. This will allow users to specify their API host URL when creating a connection in Power Automate or Power Apps.

The solution involves:

1. **Add Host URL Connection Parameter**: Update `connector-config.yaml` to include a `hostUrl` connection parameter with appropriate UI configuration
2. **Configure Policy Template**: Add a `dynamichosturl` policy template instance to `apiProperties.json` that applies the user-provided host URL to all operations
3. **Update Certification Packager**: Enhance `certification_packager.py` to support policy template configuration from `connector-config.yaml`
4. **Optional: Remove Static Host**: Optionally update the Swagger spec generation to omit or use a placeholder for the `host` field since the policy will override it

## Benefits

- **Regional Support**: Users can connect to their regional API endpoints (US, Canada, Australia, Europe)
- **Multi-Region Organizations**: Enables flows that work across multiple regions
- **Custom Deployments**: Supports organizations with custom domain configurations
- **Development Workflow**: Enables testing against regional or test environments
- **Standards Compliance**: Uses Microsoft's recommended approach for dynamic host configuration
- **Backward Compatibility**: Default value maintains current behavior for existing users

## Alternatives Considered

### Alternative 1: Multiple Connector Versions
Create separate connector packages for each region (US, Canada, Australia, Europe, etc.).

**Rejected because**:
- Maintenance burden of multiple nearly-identical connectors
- Poor user experience - users must install different connectors for different environments
- Does not support custom domains or on-premise installations

### Alternative 2: Hardcode Multiple Hosts in Config
Add a dropdown with predefined host options in the connection configuration.

**Rejected because**:
- Cannot support custom domains or on-premise installations
- Requires connector updates to add new environments
- Less flexible than allowing users to specify any valid URL

### Alternative 3: Runtime URL Parameter
Require users to specify the host URL in each action/trigger.

**Rejected because**:
- Poor user experience - repetitive configuration
- Error-prone - users could use different URLs in the same flow
- Not the recommended Power Platform pattern for this use case

## Implementation Scope

This change affects the **conversion-pipeline** capability, specifically the certification packaging phase. The changes are contained to:

1. `connector-config.yaml` - Add connection parameter configuration
2. `scripts/certification_packager.py` - Support policy templates
3. `openspec/specs/conversion-pipeline/spec.md` - Add requirements for policy template support

No changes to:
- Download script
- OpenAPI conversion logic
- Swagger cleaning logic
- Trigger augmentation logic
- Validation script (may add checks for policy templates)

## Risks and Mitigations

### Risk 1: Invalid URLs
**Risk**: Users could enter invalid URLs, causing connection failures.

**Mitigation**:
- Provide clear tooltip text with URL format examples
- Consider adding URL validation in the UI definition
- Document URL requirements in README.md

### Risk 2: Authentication Issues
**Risk**: Different hosts may require different authentication configurations.

**Mitigation**:
- Document that the same API token authentication is required for all hosts
- Add note in README about obtaining credentials for custom deployments

### Risk 3: Breaking Changes
**Risk**: Existing connections might behave differently after update.

**Mitigation**:
- Provide a default host URL (`api.fulcrumapp.com`) to maintain current behavior
- Clearly document the new parameter in release notes
- Test backward compatibility with existing connections

## Success Criteria

1. Users can specify a custom host URL when creating a new Fulcrum connection
2. The specified host URL is applied to all API requests made by the connector
3. Default host URL (`api.fulcrumapp.com`) is used if no custom URL is provided
4. Certification package passes all validation checks including policy template configuration
5. Documentation clearly explains how to configure regional and custom host URLs
6. All regional endpoints are documented (US, Canada, Australia, Europe)

## Dependencies

- Microsoft Power Platform policy templates documentation (already reviewed)
- Reference implementation from Alkymi connector (already reviewed)
- No dependency on external services or APIs
- No breaking changes to existing code

## Related Changes

This change builds on:
- Previous work: `add-certification-packaging` (archived) - established certification package generation
- Previous work: `add-powerautomate-triggers` (archived) - established trigger extensions

This change does not conflict with any active changes.

## Questions for Review

1. Should we make the host URL parameter required or optional with a default?
   - **Recommendation**: Optional with default `api.fulcrumapp.com` for backward compatibility

2. Should we support both host and basePath customization, or only host?
   - **Recommendation**: Start with host only. BasePath is currently `/api` and is standard across Fulcrum deployments

3. Should we add URL format validation in the UI definition?
   - **Recommendation**: Yes, add basic validation to help users enter valid URLs

4. Should the static `host` field be removed from the Swagger spec?
   - **Recommendation**: Keep it as a fallback value, but document that policy template overrides it

5. Should we add examples for regional endpoints and common environments?
   - **Recommendation**: Yes, add all Fulcrum regional endpoints (US, Canada, Australia, Europe) in README.md and tooltip text
