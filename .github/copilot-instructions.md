# Copilot Instructions for viash-vscode

## Project Overview

This is a VS Code extension that provides language support for [Viash](https://viash.io) components. Viash is a tool for building modular data pipeline components from scripts (Bash, Python, R, Scala, JS, C#) with YAML metadata.

## Architecture

The extension has two main features activated in [src/extension.ts](../src/extension.ts):

1. **Schema Validation** (`activateViashSchema.ts`) - Configures the Red Hat YAML extension to validate:

   - `*.vsh.yaml` files against the Viash component config schema
   - `_viash.yaml` files against the Viash package config schema
   - Schemas are fetched from `viash-io/viash-schemas` GitHub repo based on detected Viash version

2. **Test Explorer** (`viashTestAdapter.ts`) - Integrates with VS Code's Test Explorer:

   - Discovers components via `viash ns list --format json`
   - Runs tests via `viash test <config-path>`
   - Organizes tests hierarchically by namespace

## Key Files

| File | Purpose |
|------|---------|
| `src/extension.ts` | Entry point, activates both features |
| `src/activateViashSchema.ts` | Configures YAML schemas for validation |
| `src/getViashVersion.ts` | Detects installed Viash version via CLI |
| `src/getViashSchemaFile.ts` | Constructs schema URLs from viash-schemas repo |
| `src/viashTestAdapter.ts` | Test Explorer integration using vscode-test-adapter-api |
| `src/viash/nsList.ts` | Wrapper for `viash ns list` command |

## Viash Concepts

- **Component config** (`*.vsh.yaml`): Defines a component's arguments, resources, engines, and runners
- **Package config** (`_viash.yaml`): Project-wide settings at repository root
- **Namespace**: Organizational grouping for components (e.g., `tools/`, `workflows/`)
- **`viash test`**: Runs unit tests defined in a component's `test_resources`
- **`viash ns list`**: Lists all components in a project as JSON

## Development Commands

```bash
pnpm install          # Install dependencies
pnpm run compile      # Build TypeScript to out/
pnpm run watch        # Watch mode for development
pnpm run package      # Create .vsix file
pnpm run publish      # Publish to VS Code Marketplace
```

**Debug**: Press `F5` in VS Code to launch Extension Development Host with the extension loaded.

## Code Patterns

- Use `cp.spawn`/`cp.spawnSync` for Viash CLI calls (see `nsList.ts`, `getViashVersion.ts`)
- Extension depends on `redhat.vscode-yaml` - schema config goes in `yaml.schemas` workspace setting
- Test adapter uses VS Code's native `vscode.tests.createTestController` API
- All source is TypeScript with strict mode enabled

## Testing

Use `viash_project_template/` folder for manual testing - it contains example components in R, Python, and Bash with test files.
