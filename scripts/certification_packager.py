#!/usr/bin/env python3
"""
Microsoft Power Platform Certification Packager

Generates the three required files for Microsoft Power Platform connector certification:
1. apiDefinition.swagger.json - The OpenAPI/Swagger specification in JSON format
2. apiProperties.json - Connector metadata, branding, and authentication configuration
3. README.md - Documentation with prerequisites, setup, and operations

Usage:
    python certification_packager.py <swagger_yaml_path> <config_yaml_path> <output_dir>
"""

import sys
import os
import json
import yaml
from typing import Dict, Any


def load_yaml_file(file_path: str) -> Dict[str, Any]:
    """Load and parse a YAML file."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)
    except FileNotFoundError:
        print(f"ERROR: File not found: {file_path}", file=sys.stderr)
        sys.exit(1)
    except yaml.YAMLError as e:
        print(f"ERROR: Invalid YAML in {file_path}: {e}", file=sys.stderr)
        sys.exit(1)


def validate_config(config: Dict[str, Any]) -> None:
    """Validate that the configuration contains all required fields."""
    required_fields = [
        'publisher',
        'displayName',
        'description',
        'iconBrandColor',
        'supportEmail',
        'authentication',
        'prerequisites',
        'knownLimitations'
    ]
    
    missing_fields = [field for field in required_fields if field not in config or not config[field]]
    
    if missing_fields:
        print(f"ERROR: Missing required fields in connector-config.yaml: {', '.join(missing_fields)}", file=sys.stderr)
        sys.exit(1)
    
    # Validate authentication config
    auth = config.get('authentication', {})
    auth_required = ['type', 'displayName', 'description']
    auth_missing = [field for field in auth_required if field not in auth or not auth[field]]
    
    if auth_missing:
        print(f"ERROR: Missing required authentication fields: {', '.join(auth_missing)}", file=sys.stderr)
        sys.exit(1)


def generate_api_definition(swagger_spec: Dict[str, Any], output_path: str) -> None:
    """
    Generate apiDefinition.swagger.json by converting YAML to JSON.
    
    Args:
        swagger_spec: The parsed Swagger specification
        output_path: Path where the JSON file should be written
    """
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(swagger_spec, f, indent=2)
        print(f"✓ Generated: {output_path}")
    except Exception as e:
        print(f"ERROR: Failed to write apiDefinition.swagger.json: {e}", file=sys.stderr)
        sys.exit(1)


def generate_api_properties(config: Dict[str, Any], output_path: str) -> None:
    """
    Generate apiProperties.json with connection parameters and metadata.
    
    Args:
        config: The connector configuration
        output_path: Path where the JSON file should be written
    """
    auth = config['authentication']
    
    # Build connection parameters based on authentication type
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
    
    api_properties = {
        "properties": {
            "connectionParameters": connection_parameters,
            "iconBrandColor": config['iconBrandColor'],
            "capabilities": [],
            "policyTemplateInstances": []
        }
    }
    
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(api_properties, f, indent=2)
        print(f"✓ Generated: {output_path}")
    except Exception as e:
        print(f"ERROR: Failed to write apiProperties.json: {e}", file=sys.stderr)
        sys.exit(1)


def generate_readme(config: Dict[str, Any], swagger_spec: Dict[str, Any], output_path: str) -> None:
    """
    Generate README.md following Microsoft's certified connector template.
    
    Args:
        config: The connector configuration
        swagger_spec: The parsed Swagger specification
        output_path: Path where the README.md file should be written
    """
    readme_lines = []
    
    # Title and description
    readme_lines.append("# Fulcrum")
    readme_lines.append("")
    readme_lines.append(config['description'].strip())
    readme_lines.append("")
    
    # Publisher
    readme_lines.append("## Publisher")
    readme_lines.append("")
    readme_lines.append(config['publisher'])
    readme_lines.append("")
    
    # Prerequisites
    readme_lines.append("## Prerequisites")
    readme_lines.append("")
    for prereq in config['prerequisites']:
        readme_lines.append(f"- {prereq}")
    readme_lines.append("")
    
    # Obtaining Credentials
    readme_lines.append("## Obtaining Credentials")
    readme_lines.append("")
    auth = config['authentication']
    readme_lines.append(auth['description'])
    readme_lines.append("")
    if 'tooltip' in auth:
        readme_lines.append(auth['tooltip'])
        readme_lines.append("")
    
    # Getting Started (optional)
    if 'gettingStarted' in config and config['gettingStarted']:
        readme_lines.append("## Getting Started")
        readme_lines.append("")
        readme_lines.append(config['gettingStarted'].strip())
        readme_lines.append("")
    
    # Known Issues and Limitations
    readme_lines.append("## Known Issues and Limitations")
    readme_lines.append("")
    for limitation in config['knownLimitations']:
        readme_lines.append(f"- {limitation}")
    readme_lines.append("")
    
    # Write the file
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(readme_lines))
        print(f"✓ Generated: {output_path}")
    except Exception as e:
        print(f"ERROR: Failed to write README.md: {e}", file=sys.stderr)
        sys.exit(1)


def main():
    """Main entry point for the certification packager."""
    if len(sys.argv) != 4:
        print("Usage: python certification_packager.py <swagger_yaml_path> <config_yaml_path> <output_dir>")
        print("\nExample:")
        print("  python certification_packager.py build/fulcrum-power-automate-connector.yaml \\")
        print("         connector-config.yaml build/certified-connectors/Fulcrum")
        sys.exit(1)
    
    swagger_yaml_path = sys.argv[1]
    config_yaml_path = sys.argv[2]
    output_dir = sys.argv[3]
    
    # Load configuration
    print(f"Loading configuration from {config_yaml_path}...")
    config = load_yaml_file(config_yaml_path)
    validate_config(config)
    
    # Load Swagger specification
    print(f"Loading Swagger specification from {swagger_yaml_path}...")
    swagger_spec = load_yaml_file(swagger_yaml_path)
    
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    print(f"Output directory: {output_dir}")
    print("")
    
    # Generate the three required files
    print("Generating certification package files...")
    
    api_definition_path = os.path.join(output_dir, "apiDefinition.swagger.json")
    generate_api_definition(swagger_spec, api_definition_path)
    
    api_properties_path = os.path.join(output_dir, "apiProperties.json")
    generate_api_properties(config, api_properties_path)
    
    readme_path = os.path.join(output_dir, "README.md")
    generate_readme(config, swagger_spec, readme_path)
    
    print("")
    print("================================================")
    print("✓ Certification package generated successfully!")
    print("")
    print(f"Location: {output_dir}")
    print("  - apiDefinition.swagger.json")
    print("  - apiProperties.json")
    print("  - README.md")
    print("================================================")


if __name__ == "__main__":
    main()
