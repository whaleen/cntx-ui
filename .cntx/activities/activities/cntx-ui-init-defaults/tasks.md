## Relevant Files

- `bin/cntx-ui.js` - The main CLI entry point where the `init` command logic resides.
- `lib/cntx-server.js` - (Potentially) Where the `CntxServer` class is defined, which manages `.cntx` directory operations.
- `templates/minimal/.cntx/config.json` - The new default config template.
- `templates/minimal/.cntx/bundle-states.json` - The new default bundle states template.
- `templates/minimal/.cntx/hidden-files.json` - The new default hidden files template.
- `templates/minimal/.cntx/activities/activities.json` - The new default activities index.
- `templates/minimal/.cntx/activities/activities/sample-activity-1/README.md` - Sample activity 1 README.
- `templates/minimal/.cntx/activities/activities/sample-activity-1/tasks.md` - Sample activity 1 tasks.
- `templates/minimal/.cntx/activities/activities/sample-activity-1/progress.md` - Sample activity 1 progress.
- `templates/minimal/.cntx/activities/activities/sample-activity-1/notes.md` - Sample activity 1 notes.
- `templates/minimal/.cntx/activities/activities/sample-activity-2/README.md` - Sample activity 2 README.
- `templates/minimal/.cntx/activities/activities/sample-activity-2/tasks.md` - Sample activity 2 tasks.
- `templates/minimal/.cntx/activities/activities/sample-activity-2/progress.md` - Sample activity 2 progress.
- `templates/minimal/.cntx/activities/activities/sample-activity-2/notes.md` - Sample activity 2 notes.
- `templates/minimal/.cntx/activities/activities/sample-activity-3/README.md` - Sample activity 3 README.
- `templates/minimal/.cntx/activities/activities/sample-activity-3/tasks.md` - Sample activity 3 tasks.
- `templates/minimal/.cntx/activities/activities/sample-activity-3/progress.md` - Sample activity 3 progress.
- `templates/minimal/.cntx/activities/activities/sample-activity-3/notes.md` - Sample activity 3 notes.
- `templates/minimal/.cntx/agent-rules/core/default-rules.md` - Sample default agent rules.

### Notes

- The `templates/minimal/` directory will be used to store the new default `.cntx` structure.
- The `cntx-ui init` command will copy these files to the user's project `.cntx` directory.

## Tasks

- [ ] 1.0 Define Default `.cntx` Structure & Content
  - [ ] 1.1 Create `templates/minimal/.cntx/` directory structure.
  - [ ] 1.2 Define default `config.json` with `master`, `api`, `ui`, `config`, `docs` bundles.
  - [ ] 1.3 Define default `hidden-files.json` with common ignore patterns.
  - [ ] 1.4 Define default `semantic-cache.json` (initially empty or basic structure).
  - [ ] 1.5 Create `templates/minimal/.cntx/activities/activities.json` with entries for 3 sample activities.
  - [ ] 1.6 Create 3 extremely basic sample activities (e.g., "TypeScript Refactor", "API Audit", "Agent Stories") with minimal `README.md`, `tasks.md`, `progress.md`, `notes.md`.
  - [ ] 1.7 Define default `agent-rules/core/default-rules.md` with basic agent guidance.

- [ ] 2.0 Extend Existing `cntx-ui init` Command
  - [ ] 2.1 Locate the existing `cntx-ui init` command logic in `bin/cntx-ui.js`.
  - [ ] 2.2 Modify the `init` command to copy the contents of `templates/minimal/.cntx/` to the user's `.cntx` directory.
  - [ ] 2.3 Ensure the copy operation handles existing files gracefully (e.g., doesn't overwrite user changes unless explicitly allowed).
  - [ ] 2.4 Verify that the `CntxServer` correctly loads these new default files upon startup.

- [ ] 3.0 Integrate Minimal Default Activities & Agent Rules
  - [ ] 3.1 Ensure the `activities.json` is correctly loaded by the `CntxServer`.
  - [ ] 3.2 Verify that the sample activities appear correctly in the `cntx-ui` web interface.
  - [ ] 3.3 Verify that the default agent rules are accessible and can be loaded by the system.

- [ ] 4.0 Testing & Validation
  - [ ] 4.1 Write unit/integration tests for the `cntx-ui init` command.
  - [ ] 4.2 Test the `init` command in a clean project directory.
  - [ ] 4.3 Verify that all default files are created correctly and are valid JSON/Markdown.
  - [ ] 4.4 Confirm that the `cntx-ui` web UI functions as expected with the initialized `.cntx` directory.

- [ ] 5.0 Documentation & Release Preparation
  - [ ] 5.1 Update the main `README.md` with instructions on using the new `cntx-ui init` command.
  - [ ] 5.2 Add a changelog entry for this feature.
  - [ ] 5.3 Prepare for release.
