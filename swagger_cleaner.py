import json
import yaml
import sys
import os
import re
from typing import Dict, Any, Union, List, Optional

# Define the endpoints to keep in the cleaned version
# Format: ['/path/method', '/another/path/method']
# Example: ['/pets/get', '/pets/{petId}/get', '/users/post']
ENDPOINTS_TO_KEEP = [
    "/v2/records.json/get",
    "/v2/records/{record_id}.json/get",
    "/v2/webhooks.json/post",
    "/v2/webhooks/{webhook_id}.json/delete",
]


def remove_anyof_oneof(obj: Any) -> Any:
    """
    Recursively remove anyOf and oneOf properties from a dictionary.
    """
    if isinstance(obj, dict):
        # Create a new dict without anyOf and oneOf
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

                # Add description
                endpoint_data["description"] = description

                # Capitalize first letter of operationId if present
                if "operationId" in endpoint_data and endpoint_data["operationId"]:
                    operation_id = endpoint_data["operationId"]
                    endpoint_data["operationId"] = (
                        operation_id[0].upper() + operation_id[1:]
                    )

    return result


def filter_endpoints(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Filter the Swagger/OpenAPI specification to keep only specified endpoints.

    Args:
        data: The parsed Swagger/OpenAPI specification

    Returns:
        Filtered Swagger/OpenAPI specification
    """
    # If no endpoints specified, return the full data
    if not ENDPOINTS_TO_KEEP:
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
                        endpoint_key in ENDPOINTS_TO_KEEP
                        or endpoint_key_lower in ENDPOINTS_TO_KEEP
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

        # Then enhance the endpoints
        enhanced_data = enhance_endpoints(filtered_data)

        # Finally process the data to remove anyOf and oneOf
        cleaned_data = remove_anyof_oneof(enhanced_data)

        # Write the cleaned data back
        with open(output_file, "w", encoding="utf-8") as f:
            if ext in [".yaml", ".yml"]:
                yaml.dump(cleaned_data, f, default_flow_style=False, sort_keys=False)
            else:  # Default to JSON
                json.dump(cleaned_data, f, indent=2)

        # Print summary of operation
        if ENDPOINTS_TO_KEEP:
            endpoint_count = sum(
                1
                for path in cleaned_data.get("paths", {}).values()
                for method in path.keys()
                if method.lower()
                in ["get", "post", "put", "delete", "patch", "options", "head"]
            )
            print(f"Successfully processed {input_file} -> {output_file}")
            print(
                f"Filtered to {endpoint_count} endpoints out of {len(ENDPOINTS_TO_KEEP)} specified"
            )
            print("Added descriptions and capitalized operationIds")

            # Check if fewer endpoints than specified
            if endpoint_count < len(ENDPOINTS_TO_KEEP):
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
            "Define endpoints to keep by editing the ENDPOINTS_TO_KEEP array at the top of the script"
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
