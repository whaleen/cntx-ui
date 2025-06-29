# Notes: cntx-ui Init Defaults

## General Notes

This file is for capturing thoughts, research, and decisions related to defining and implementing the default `.cntx` directory structure for `cntx-ui init`.

## Technical Decisions

- **Decision**: Use `templates/minimal/` for the default `.cntx` structure.
- **Rationale**: Provides a clear separation between the source of the default files and the user's project directory.

- **Decision**: The `init` command will perform a copy operation.
- **Rationale**: Simple and effective for initial setup. Will need to consider merge strategies for existing files.

## Research & Links

*   **Existing `cntx-ui init` logic:** Need to thoroughly review `bin/cntx-ui.js` to understand current implementation.
*   **File Copying in Node.js:** Investigate `fs.copyFile` or `fs-extra` for robust directory copying.

## Open Questions

*   How should the `init` command handle conflicts if `.cntx` files already exist in the user's project? (e.g., prompt, overwrite, merge?)
*   What is the exact content for the 3 minimal sample activities?
*   What should be the initial content of `agent-rules/core/default-rules.md`?
