# OpenAPI Power Automate Compatibility Tool

This tool facilitates the conversion of OpenAPI 3.0 specifications to the Swagger 2.0 (OpenAPI 2.0) format, with a focus on ensuring compatibility with Microsoft Power Automate. It applies the necessary transformations to meet Microsoft's validation requirements.

## Usage Instructions

- Clone this repository to your local machine.

- Add your OpenAPI 3.1 specification to the repository root and name the file:
   `api-3.1.json`

**Example:**

![image](https://github.com/user-attachments/assets/757f1865-37b6-404f-bfab-c87784d5acef)

- Execute the tool using the following command:
<pre> ./convert_openapi.sh </pre>

- Upon successful conversion, a confirmation message will be displayed.

- The output file, swagger-2.0-cleaned.yaml, is the final result and should be ready for import into Microsoft Power Automate. For example:
<img src="https://github.com/user-attachments/assets/fc9bbac6-44c5-46aa-9f55-32f9cc5e2794" alt="Power Automate Import Example" width="500"/>
