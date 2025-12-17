# Contributing to viash-vscode

Thank you for your interest in contributing to the Viash VS Code extension! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Release Process](#release-process)

## Code of Conduct

Please be respectful and considerate in all interactions. We welcome contributions from everyone and are committed to providing a friendly, safe, and welcoming environment.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS version recommended)
- [pnpm](https://pnpm.io/) package manager
- [Visual Studio Code](https://code.visualstudio.com/)
- [Viash](https://viash.io/installation) (for testing the extension functionality)

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:

   ```bash
   git clone https://github.com/YOUR_USERNAME/viash-vscode.git
   cd viash-vscode
   ```

3. Add the upstream remote:

   ```bash
   git remote add upstream https://github.com/viash-io/viash-vscode.git
   ```

## Development Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Compile the extension:

   ```bash
   pnpm run compile
   ```

3. Open the project in VS Code:

   ```bash
   code .
   ```

4. Press `F5` to open a new VS Code window with the extension loaded (Extension Development Host).

### Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm run compile` | Compile TypeScript to JavaScript |
| `pnpm run watch` | Watch for changes and recompile automatically |
| `pnpm run package` | Package the extension into a `.vsix` file |
| `pnpm run publish` | Publish the extension to the VS Code Marketplace |

## Project Structure

    viash-vscode/
    ├── src/                      # Source code
    │   ├── extension.ts          # Extension entry point
    │   ├── activateViashSchema.ts # Schema activation logic
    │   ├── getViashSchemaFile.ts # Schema file utilities
    │   ├── getViashVersion.ts    # Viash version detection
    │   ├── viashTestAdapter.ts   # Test adapter for Viash components
    │   └── viash/                # Viash-specific utilities
    │       └── nsList.ts         # Namespace listing
    ├── assets/                   # Static assets (images, logos)
    ├── viash_project_template/   # Example Viash project for testing
    ├── package.json              # Extension manifest and dependencies
    ├── tsconfig.json             # TypeScript configuration
    └── out/                      # Compiled JavaScript (generated)

## Making Changes

### Branching Strategy

1. Create a new branch from `main` for your changes:

   ```bash
   git checkout main
   git pull upstream main
   git checkout -b feature/your-feature-name
   ```

2. Use descriptive branch names:
   - `feature/` - for new features
   - `fix/` - for bug fixes
   - `docs/` - for documentation changes
   - `refactor/` - for code refactoring

### Coding Guidelines

- Follow the existing code style
- Use TypeScript for all source code
- Add comments for complex logic
- Keep functions small and focused

### Updating the Changelog

When making changes, add an entry to [CHANGELOG.md](CHANGELOG.md) describing your changes. Follow the existing format:

```markdown
## NEW FUNCTIONALITY
* Description of new feature (PR #XX).

## MINOR CHANGES
* Description of minor change (PR #XX).

## BUG FIXES
* Description of bug fix (PR #XX).
```

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

## Submitting Changes

### Pull Request Process

1. Ensure your code compiles without errors:

   ```bash
   pnpm run compile
   ```

2. Commit your changes with a descriptive message:

   ```bash
   git add .
   git commit -m "feat: add description of your changes"
   ```

3. Push your branch to your fork:

   ```bash
   git push origin feature/your-feature-name
   ```

4. Open a Pull Request on GitHub against the `main` branch

### Pull Request Guidelines

- Provide a clear description of the changes
- Reference any related issues
- Update documentation if needed
- Add changelog entries for user-facing changes
- Ensure all checks pass

## Release Process

Releases are managed by the maintainers. The process involves:

1. Update version in `package.json`
2. Update `CHANGELOG.md` with the new version
3. Create a git tag
4. Package and publish to the VS Code Marketplace:

   ```bash
   pnpm run package
   pnpm run publish
   ```

## Dependencies

This extension depends on:
- [Red Hat YAML Extension](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml) - For YAML language support
- [vscode-test-adapter-api](https://www.npmjs.com/package/vscode-test-adapter-api) - For test explorer integration

## Getting Help

- **Issues**: Report bugs or request features on [GitHub Issues](https://github.com/viash-io/viash-vscode/issues)
- **Viash Documentation**: Learn more about Viash at [viash.io](https://viash.io)

## License

By contributing to this project, you agree that your contributions will be licensed under the [GPL-3.0 License](LICENSE.md).

---

Thank you for contributing to viash-vscode! 🎉
