# viash-vscode v0.3.0

## NEW FUNCTIONALITY

* Support for multiple Viash packages in a workspace, each with its own `viash_version` (PR #39).

* Schema validation is now scoped per package directory, allowing different Viash versions to use their correct schemas (PR #39).

* Automatically update schemas when `_viash.yaml` files are created, modified, or deleted (PR #39).

* YAML parsing of project configs supporting Viash's `__merge__` operator for inheriting from other YAML files (PR #39).

* Added unit tests for YAML merge functionality with comprehensive test coverage (PR #39).

* Added CI workflow for running tests on pull requests (PR #39).

## MAJOR CHANGES

* `_viash.yaml` and `*.vsh.yaml` files in subdirectories are now properly detected and validated (PR #39).

* Tests are now run from the correct package root directory, fixing issues with relative paths (PR #39).

## MINOR CHANGES

* Improved error handling when Viash is not installed (PR #39).

* Added file system watcher for `_viash.yaml` changes to refresh test discovery (PR #39).

* Removed unused Debug test profile (PR #39).

# viash-vscode v0.2.2

## MINOR CHANGES

* Update dependencies (PR #36).

## DOCUMENTATION

* Add contributing guidelines (PR #36).
* Fully switch from pnpm back to npm (PR #37).

# viash-vscode v0.2.1

## MINOR CHANGES

* Update dependencies (PR #3).

# viash-vscode v0.2.0

## NEW FUNCTIONALITY

* Add support for unit testing Viash components (PR #2).

# viash-vscode v0.1.1

Republish of v0.1.0 to fix the version number.

# viash-vscode v0.1.0

## NEW FUNCTIONALITY

* Add support for validating Viash project config at `_viash.yaml` (PR #1).

## MAJOR CHANGES

* Use the Viash schemas from `viash-io/viash-schemas` instead of using a local cache (PR #1).

# viash-vscode v0.0.2

## MINOR CHANGES

* Lowered the minimum vscode version from 1.91.0 to 1.63.0.

* Added `redhad.vscode-yaml` as an extension dependency.

* Removed `onLanguage:yaml` as an activation event.

# viash-vscode v0.0.1

Initial release.

This extension provides language support for Viash components (`*.vsh.yaml`).