import json
import yaml
import sys
import os
import re
from typing import Dict, Any, Union, List, Optional

# Global configuration loaded from connector-config.yaml
CONFIG = None

def load_config(config_path: str = None) -> Dict[str, Any]:
    """
    Load configuration from connector-config.yaml.
    
    Args:
        config_path: Path to the config file. If None, looks for connector-config.yaml in repo root.
        
    Returns:
        Configuration dictionary
        
    Raises:
        FileNotFoundError: If config file doesn't exist
        yaml.YAMLError: If config file is invalid YAML
    """
    if config_path is None:
        # Default to connector-config.yaml in repo root (one level up from scripts/)
        script_dir = os.path.dirname(os.path.abspath(__file__))
        config_path = os.path.join(os.path.dirname(script_dir), "connector-config.yaml")
    
    if not os.path.exists(config_path):
        raise FileNotFoundError(f"Configuration file not found: {config_path}")
    
    with open(config_path, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)
    
    # Validate required swagger cleaner configuration
    if "swaggerCleaner" not in config:
        raise ValueError("Configuration file missing 'swaggerCleaner' section")
    
    return config


def get_endpoints_to_keep() -> List[str]:
    """Get the list of endpoints to keep from configuration."""
    global CONFIG
    if CONFIG is None:
        CONFIG = load_config()
    return CONFIG.get("swaggerCleaner", {}).get("endpointsToKeep", [])


def get_parameters_to_remove() -> List[Dict[str, str]]:
    """Get the list of parameters to remove from configuration."""
    global CONFIG
    if CONFIG is None:
        CONFIG = load_config()
    return CONFIG.get("swaggerCleaner", {}).get("parametersToRemove", [])


def get_info_config() -> Dict[str, Any]:
    """Get the info section configuration."""
    global CONFIG
    if CONFIG is None:
        CONFIG = load_config()
    return CONFIG.get("swaggerCleaner", {}).get("info", {})


def get_connector_metadata() -> List[Dict[str, str]]:
    """Get the x-ms-connector-metadata configuration."""
    global CONFIG
    if CONFIG is None:
        CONFIG = load_config()
    return CONFIG.get("swaggerCleaner", {}).get("connectorMetadata", [])



def remove_anyof_oneof(obj: Any) -> Any:
    """
    Recursively remove anyOf and oneOf properties from a dictionary.
    Preserves x-ms-* extensions for Power Automate compatibility.
    """
    if isinstance(obj, dict):
        # Create a new dict without anyOf and oneOf, but preserve x-ms-* extensions
        result = {k: v for k, v in obj.items() if k not in ["anyOf", "oneOf"]}

        # Process remaining items recursively
        for key, value in result.items():
            result[key] = remove_anyof_oneof(value)

        return result
    elif isinstance(obj, list):
        # Process list items recursively
        return [remove_anyof_oneof(item) for item in obj]
    else:
        # Return primitive values as-is
        return obj


def get_endpoint_name(path: str) -> str:
    """
    Extract the endpoint name from a path, skipping API version prefixes.

    Args:
        path: The endpoint path (e.g., '/v2/pets/{petId}')

    Returns:
        The endpoint name (e.g., 'pets')
    """
    # Remove initial slash if present
    clean_path = path[1:] if path.startswith("/") else path

    # Split the path into parts
    parts = clean_path.split("/")

    # Skip empty parts
    parts = [p for p in parts if p]

    if not parts:
        return "Root"

    # Check if the first part is a version identifier (like v1, v2, api, etc.)
    version_pattern = re.compile(r"^(v\d+|api|version\d+)$", re.IGNORECASE)

    # If first segment is a version, take the second segment as the endpoint name
    if parts and version_pattern.match(parts[0]):
        if len(parts) > 1:
            # Return the second segment (after the version)
            return parts[1].split(".")[0]  # Remove file extensions like .json
        else:
            return "API"  # Just the version with no endpoint
    else:
        # No version prefix, use the first segment
        return parts[0].split(".")[0]  # Remove file extensions like .json


def enhance_endpoints(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Enhance endpoints by:
    1. Adding a description that is the same as the endpoint name
    2. Capitalizing the first letter of operationId
    3. Adding x-ms-summary to all parameters (Power Automate requirement)
    4. Ensuring descriptions exist on parameters where required

    Args:
        data: The parsed Swagger/OpenAPI specification

    Returns:
        Enhanced Swagger/OpenAPI specification
    """
    result = data.copy()

    # Handle OpenAPI spec
    if "paths" in result:
        for path, methods in result["paths"].items():
            endpoint_name = get_endpoint_name(path)

            for method, endpoint_data in methods.items():
                # Skip non-method properties
                if method.lower() not in [
                    "get",
                    "post",
                    "put",
                    "delete",
                    "patch",
                    "options",
                    "head",
                ]:
                    continue

                # Create description with capitalized endpoint name and method
                capitalized_name = (
                    endpoint_name[0].upper() + endpoint_name[1:]
                    if endpoint_name
                    else "Root"
                )
                method_name = method.upper()
                description = f"{capitalized_name} {method_name}"

                # Add description only if missing
                if "description" not in endpoint_data or not endpoint_data["description"]:
                    endpoint_data["description"] = description

                # Capitalize first letter of operationId if present
                if "operationId" in endpoint_data and endpoint_data["operationId"]:
                    operation_id = endpoint_data["operationId"]
                    endpoint_data["operationId"] = (
                        operation_id[0].upper() + operation_id[1:]
                    )

                # Add x-ms-summary and descriptions to parameters
                if "parameters" in endpoint_data:
                    for param in endpoint_data["parameters"]:
                        # Add x-ms-summary if not present
                        if "x-ms-summary" not in param:
                            # Use the parameter name as the summary, but make it more readable
                            param_name = param.get("name", "Parameter")
                            # Convert snake_case or camelCase to Title Case
                            readable_name = param_name.replace("_", " ").replace("-", " ")
                            readable_name = " ".join(word.capitalize() for word in readable_name.split())
                            param["x-ms-summary"] = readable_name
                        
                        # Ensure description exists if not present
                        if "description" not in param:
                            param["description"] = param.get("x-ms-summary", param.get("name", "Parameter"))
                        
                        # Add x-ms-url-encoding for path parameters
                        if param.get("in") == "path" and "x-ms-url-encoding" not in param:
                            param["x-ms-url-encoding"] = "single"
                        
                        # Set x-ms-visibility to advanced for x-skipworkflows and x-skipwebhooks parameters
                        param_name = param.get("name", "")
                        if param_name.lower() in ["x-skipworkflows", "x-skipwebhooks"]:
                            param["x-ms-visibility"] = "advanced"

    return result


def filter_endpoints(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Filter the Swagger/OpenAPI specification to keep only specified endpoints.

    Args:
        data: The parsed Swagger/OpenAPI specification

    Returns:
        Filtered Swagger/OpenAPI specification
    """
    endpoints_to_keep = get_endpoints_to_keep()
    
    # If no endpoints specified, return the full data
    if not endpoints_to_keep:
        return data

    result = data.copy()

    # Handle OpenAPI spec
    if "paths" in result:
        filtered_paths = {}

        for path, methods in result["paths"].items():
            filtered_methods = {}

            for method, endpoint_data in methods.items():
                endpoint_key = f"{path}/{method}"
                method_lower = method.lower()
                endpoint_key_lower = f"{path}/{method_lower}"

                # Check if this is a HTTP method or a property like parameters
                if method.lower() in [
                    "get",
                    "post",
                    "put",
                    "delete",
                    "patch",
                    "options",
                    "head",
                ]:
                    # Check if the endpoint should be kept
                    if (
                        endpoint_key in endpoints_to_keep
                        or endpoint_key_lower in endpoints_to_keep
                    ):
                        filtered_methods[method] = endpoint_data
                else:
                    # Keep non-HTTP method properties (like parameters)
                    filtered_methods[method] = endpoint_data

            # Only include the path if it has methods
            if filtered_methods:
                filtered_paths[path] = filtered_methods

        result["paths"] = filtered_paths

    return result


def find_used_models(data: Dict[str, Any]) -> set:
    """
    Find all model names that are referenced in the specification.

    Args:
        data: The parsed Swagger/OpenAPI specification

    Returns:
        Set of model names that are used
    """
    used_models = set()

    def extract_refs(obj: Any) -> None:
        """Recursively extract all $ref values."""
        if isinstance(obj, dict):
            if "$ref" in obj:
                ref = obj["$ref"]
                # Extract model name from reference like "#/definitions/ModelName"
                if ref.startswith("#/definitions/"):
                    model_name = ref.replace("#/definitions/", "")
                    used_models.add(model_name)
            for value in obj.values():
                extract_refs(value)
        elif isinstance(obj, list):
            for item in obj:
                extract_refs(item)

    extract_refs(data)
    return used_models


def remove_unused_models(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Remove unused model definitions from the specification.

    Args:
        data: The parsed Swagger/OpenAPI specification

    Returns:
        Specification with unused models removed
    """
    result = data.copy()

    if "definitions" not in result:
        return result

    # Find all models that are actually used
    used_models = find_used_models(data)

    # Keep track of which models were removed
    removed_models = []

    # Filter definitions to only include used models
    filtered_definitions = {}
    for model_name, model_def in result["definitions"].items():
        if model_name in used_models:
            filtered_definitions[model_name] = model_def
        else:
            removed_models.append(model_name)

    result["definitions"] = filtered_definitions

    if removed_models:
        print(f"Removed {len(removed_models)} unused model(s): {', '.join(sorted(removed_models))}")

    return result


def remove_description_from_refs(obj: Any) -> Any:
    """
    Recursively remove description properties from objects that have $ref.
    When $ref is defined, no other properties should be specified per OpenAPI spec.
    
    Args:
        obj: The object to process
        
    Returns:
        Processed object with descriptions removed from $ref objects
    """
    if isinstance(obj, dict):
        # If this object has a $ref, remove description and other non-extension properties
        if "$ref" in obj:
            # Keep only $ref and x-* extension properties
            result = {"$ref": obj["$ref"]}
            for key, value in obj.items():
                if key.startswith("x-"):
                    result[key] = value
            return result
        else:
            # Process all values recursively
            return {k: remove_description_from_refs(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [remove_description_from_refs(item) for item in obj]
    else:
        return obj


def keep_only_success_responses(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Keep only success responses (200, 201, 204) and remove error responses (400, 401, 404, 422, etc.)
    This addresses the Power Automate warning about multiple response schemas.
    
    Args:
        data: The parsed Swagger/OpenAPI specification
        
    Returns:
        Specification with only success responses
    """
    result = data.copy()
    
    if "paths" not in result:
        return result
        
    for path, methods in result["paths"].items():
        for method, endpoint_data in methods.items():
            # Skip non-method properties
            if method.lower() not in ["get", "post", "put", "delete", "patch", "options", "head"]:
                continue
                
            if "responses" in endpoint_data:
                # Keep only success responses (2xx)
                filtered_responses = {}
                for status_code, response in endpoint_data["responses"].items():
                    if status_code.startswith("2"):  # 200, 201, 204, etc.
                        filtered_responses[status_code] = response
                        
                endpoint_data["responses"] = filtered_responses
                
    return result


def make_webhook_url_required(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Make the webhook URL property required in the WebhookRequest schema.
    This addresses the Power Automate warning about notification URL not being required.
    
    Args:
        data: The parsed Swagger/OpenAPI specification
        
    Returns:
        Specification with webhook URL marked as required
    """
    result = data.copy()
    
    if "definitions" not in result:
        return result
        
    # Find WebhookRequest definition
    if "WebhookRequest" in result["definitions"]:
        webhook_def = result["definitions"]["WebhookRequest"]
        if "properties" in webhook_def and "webhook" in webhook_def["properties"]:
            webhook_prop = webhook_def["properties"]["webhook"]
            if "properties" in webhook_prop and "url" in webhook_prop["properties"]:
                # Make url required
                if "required" not in webhook_prop:
                    webhook_prop["required"] = []
                if "url" not in webhook_prop["required"]:
                    webhook_prop["required"].append("url")
                    
            # Remove unsupported minProperties keyword
            if "minProperties" in webhook_prop:
                del webhook_prop["minProperties"]
                
    return result


def remove_empty_success_response_schemas(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Remove schema definitions from responses that reference EmptySuccessResponse.
    Empty success responses should not define a schema at all.
    
    Args:
        data: The parsed Swagger/OpenAPI specification
        
    Returns:
        Specification with EmptySuccessResponse schemas removed
    """
    result = data.copy()
    
    if "paths" not in result:
        return result
    
    removed_count = 0
    
    for path, methods in result["paths"].items():
        for method, endpoint_data in methods.items():
            # Skip non-method properties
            if method.lower() not in ["get", "post", "put", "delete", "patch", "options", "head"]:
                continue
                
            if "responses" in endpoint_data:
                for status_code, response in endpoint_data["responses"].items():
                    # Check if response has a schema that references EmptySuccessResponse
                    if "schema" in response:
                        schema = response["schema"]
                        # Check for direct $ref or nested $ref
                        if isinstance(schema, dict):
                            ref = schema.get("$ref", "")
                            if "EmptySuccessResponse" in ref:
                                # Remove the schema entirely
                                del response["schema"]
                                removed_count += 1
                                
    if removed_count > 0:
        print(f"Removed {removed_count} EmptySuccessResponse schema reference(s)")
    
    return result


def remove_configured_parameters(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Remove parameters from all endpoints based on configuration.
    Parameters like x-apitoken and accept headers are removed since they're
    handled by Power Automate's connection configuration.
    
    Args:
        data: The parsed Swagger/OpenAPI specification
        
    Returns:
        Specification with configured parameters removed
    """
    result = data.copy()
    
    if "paths" not in result:
        return result
    
    params_to_remove = get_parameters_to_remove()
    if not params_to_remove:
        return result
    
    removed_count = 0
    
    for path, methods in result["paths"].items():
        for method, endpoint_data in methods.items():
            # Skip non-method properties
            if method.lower() not in ["get", "post", "put", "delete", "patch", "options", "head"]:
                continue
                
            if "parameters" in endpoint_data:
                original_count = len(endpoint_data["parameters"])
                
                # Filter out configured parameters
                filtered_params = []
                for param in endpoint_data["parameters"]:
                    should_remove = False
                    param_name = param.get("name", "").lower()
                    param_in = param.get("in", "")
                    
                    for removal_config in params_to_remove:
                        config_name = removal_config.get("name", "").lower()
                        config_in = removal_config.get("in", "")
                        
                        # Check if parameter matches removal criteria
                        if param_name == config_name and (not config_in or param_in == config_in):
                            should_remove = True
                            break
                    
                    if not should_remove:
                        filtered_params.append(param)
                
                endpoint_data["parameters"] = filtered_params
                removed_count += (original_count - len(filtered_params))
                
                # Remove parameters key if empty
                if not endpoint_data["parameters"]:
                    del endpoint_data["parameters"]
    
    if removed_count > 0:
        print(f"Removed {removed_count} configured parameter(s) from endpoints")
    
    return result


def fix_info_section(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Fix the info section to meet Power Automate certification requirements:
    1. Remove restricted words from title (api, connector)
    2. Ensure title ends with alphanumeric character
    3. Add description if missing (30-500 characters)
    4. Add contact property if missing
    5. Add x-ms-connector-metadata at root level (not in info)

    Args:
        data: The parsed Swagger/OpenAPI specification

    Returns:
        Specification with fixed info section
    """
    result = data.copy()

    if "info" not in result:
        return result

    info_config = get_info_config()
    restricted_words = info_config.get("titleRestrictedWords", ["api", "connector"])
    contact_config = info_config.get("contact", {})
    default_description = info_config.get("description", "")

    # Fix title - remove restricted words
    if "title" in result["info"]:
        title = result["info"]["title"]
        # Remove restricted words (case insensitive)
        for word in restricted_words:
            title = re.sub(rf'\b{word}\b', '', title, flags=re.IGNORECASE)
        # Clean up extra spaces
        title = re.sub(r'\s+', ' ', title).strip()
        # Ensure title ends with alphanumeric character
        title = re.sub(r'[^a-zA-Z0-9]+$', '', title)
        result["info"]["title"] = title

    # Add description if missing (must be 30-500 characters)
    if "description" not in result["info"] or not result["info"]["description"] or len(result["info"]["description"]) < 30:
        if default_description:
            result["info"]["description"] = default_description

    # Add contact if missing
    if "contact" not in result["info"] and contact_config:
        result["info"]["contact"] = contact_config

    # Remove x-ms-connector-metadata from info if present (it should be at root level)
    if "x-ms-connector-metadata" in result["info"]:
        del result["info"]["x-ms-connector-metadata"]

    # Add x-ms-connector-metadata at root level if missing
    if "x-ms-connector-metadata" not in result:
        connector_metadata = get_connector_metadata()
        if connector_metadata:
            result["x-ms-connector-metadata"] = connector_metadata

    return result


def process_file(input_file: str, output_file: str = None) -> None:
    """
    Process a Swagger/OpenAPI file to:
    1. Filter to keep only specified endpoints
    2. Remove anyOf and oneOf properties
    3. Add descriptions to endpoints
    4. Capitalize operationId first letter

    Args:
        input_file: Path to the input Swagger/OpenAPI file
        output_file: Path to the output file. If None, will use input_file with '-cleaned' suffix
    """
    if not output_file:
        base, ext = os.path.splitext(input_file)
        output_file = f"{base}-cleaned{ext}"

    # Determine file format based on extension
    _, ext = os.path.splitext(input_file.lower())

    try:
        # Read the file
        with open(input_file, "r", encoding="utf-8") as f:
            if ext in [".yaml", ".yml"]:
                data = yaml.safe_load(f)
            else:  # Default to JSON
                data = json.load(f)

        # First filter endpoints
        filtered_data = filter_endpoints(data)

        # Keep only success responses (remove error responses)
        # Do this BEFORE removing unused models so error response models get cleaned up
        success_only = keep_only_success_responses(filtered_data)

        # Fix info section for Power Automate certification
        fixed_info = fix_info_section(success_only)

        # Make webhook URL required and remove unsupported keywords
        fixed_webhooks = make_webhook_url_required(fixed_info)

        # Remove EmptySuccessResponse schemas
        no_empty_schemas = remove_empty_success_response_schemas(fixed_webhooks)

        # Remove configured parameters (authentication and accept headers handled by Power Automate)
        no_unwanted_params = remove_configured_parameters(no_empty_schemas)
        
        # Remove unused models AFTER removing EmptySuccessResponse refs and error responses
        # This ensures EmptySuccessResponse and other now-unused models are properly removed
        cleaned_models = remove_unused_models(no_unwanted_params)

        # Then enhance the endpoints
        enhanced_data = enhance_endpoints(cleaned_models)

        # Remove descriptions from $ref properties
        no_ref_descriptions = remove_description_from_refs(enhanced_data)

        # Finally process the data to remove anyOf and oneOf
        cleaned_data = remove_anyof_oneof(no_ref_descriptions)

        # Write the cleaned data back
        with open(output_file, "w", encoding="utf-8") as f:
            if ext in [".yaml", ".yml"]:
                yaml.dump(cleaned_data, f, default_flow_style=False, sort_keys=False)
            else:  # Default to JSON
                json.dump(cleaned_data, f, indent=2)

        # Print summary of operation
        endpoints_to_keep = get_endpoints_to_keep()
        if endpoints_to_keep:
            endpoint_count = sum(
                1
                for path in cleaned_data.get("paths", {}).values()
                for method in path.keys()
                if method.lower()
                in ["get", "post", "put", "delete", "patch", "options", "head"]
            )
            print(f"Successfully processed {input_file} -> {output_file}")
            print(
                f"Filtered to {endpoint_count} endpoints out of {len(endpoints_to_keep)} specified"
            )
            print("Added descriptions and capitalized operationIds")

            # Check if fewer endpoints than specified
            if endpoint_count < len(endpoints_to_keep):
                print(
                    "Warning: Some specified endpoints were not found in the input file."
                )
                print("Use --list-endpoints to see available endpoints.")
        else:
            print(
                f"Successfully processed {input_file} -> {output_file} (all endpoints kept)"
            )
            print("Added descriptions and capitalized operationIds")

    except Exception as e:
        print(f"Error processing {input_file}: {str(e)}")
        sys.exit(1)


def print_available_endpoints(input_file: str) -> None:
    """
    Print all available endpoints in the Swagger/OpenAPI file.

    Args:
        input_file: Path to the input Swagger/OpenAPI file
    """
    _, ext = os.path.splitext(input_file.lower())

    try:
        # Read the file
        with open(input_file, "r", encoding="utf-8") as f:
            if ext in [".yaml", ".yml"]:
                data = yaml.safe_load(f)
            else:  # Default to JSON
                data = json.load(f)

        print("Available endpoints:")

        if "paths" in data:
            endpoints = []
            for path, methods in data["paths"].items():
                for method, _ in methods.items():
                    if method.lower() in [
                        "get",
                        "post",
                        "put",
                        "delete",
                        "patch",
                        "options",
                        "head",
                    ]:
                        endpoint = f"{path}/{method.lower()}"
                        endpoints.append(endpoint)

            # Sort endpoints for easier reading
            endpoints.sort()
            for endpoint in endpoints:
                print(f'  "{endpoint}",')

    except Exception as e:
        print(f"Error reading {input_file}: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] in ["-h", "--help"]:
        print("Usage: python swagger_cleaner.py <input_file> [output_file]")
        print("       python swagger_cleaner.py --list-endpoints <input_file>")
        print("\nOptions:")
        print("  --list-endpoints    List all available endpoints in the input file")
        print(
            '\nEndpoint format: "/path/method" (e.g., "/pets/get", "/users/{userId}/put")'
        )
        print(
            "Configure endpoints to keep and other settings in connector-config.yaml"
        )
        sys.exit(1)

    if sys.argv[1] == "--list-endpoints":
        if len(sys.argv) < 3:
            print("Error: Input file required with --list-endpoints option")
            sys.exit(1)
        print_available_endpoints(sys.argv[2])
    else:
        input_file = sys.argv[1]
        output_file = sys.argv[2] if len(sys.argv) > 2 else None

        process_file(input_file, output_file)
