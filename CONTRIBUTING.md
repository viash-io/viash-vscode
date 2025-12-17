# Contributing to viash-vscode

Thank you for your interest in contributing to the Viash VS Code extension! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Contributing to viash-vscode](#contributing-to-viash-vscode)
  - [Table of Contents](#table-of-contents)
  - [Prerequisites](#prerequisites)
  - [Development Setup](#development-setup)
    - [Available Scripts](#available-scripts)
  - [Testing](#testing)
    - [Manual Testing](#manual-testing)
    - [Testing with Example Files](#testing-with-example-files)
  - [Release Process](#release-process)

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS version recommended)
- [Visual Studio Code](https://code.visualstudio.com/)
- [Viash](https://viash.io/installation) (for testing the extension functionality)

## Development Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Compile the extension:

   ```bash
   npm run compile
   ```

3. Open the project in VS Code:

   ```bash
   code .
   ```

4. Press `F5` to open a new VS Code window with the extension loaded (Extension Development Host).

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run compile` | Compile TypeScript to JavaScript |
| `npm run watch` | Watch for changes and recompile automatically |
| `npm run package` | Package the extension into a `.vsix` file |
| `npm run publish` | Publish the extension to the VS Code Marketplace |

## Testing

### Manual Testing

1. Press `F5` in VS Code to launch the Extension Development Host
2. Open the `viash_project_template/` folder in the new window
3. Test the extension features:
   - Open a `.vsh.yaml` file and verify syntax highlighting and validation
   - Open `_viash.yaml` and verify project config validation
   - Test the unit testing functionality with Viash components

### Testing with Example Files

The `viash_project_template/` directory contains example Viash components you can use for testing:

- `src/template/combine_columns/` - R-based component
- `src/template/remove_comments/` - Shell-based component
- `src/template/take_column/` - Python-based component
- `src/template/workflow/` - Nextflow workflow

## Release Process

Releases are managed by the maintainers. The process involves:

1. Update version in `package.json`
2. Update `CHANGELOG.md` with the new version
3. Create a git tag
4. Package and publish to the VS Code Marketplace:

   ```bash
   npm run package
   npm run publish
   ```
