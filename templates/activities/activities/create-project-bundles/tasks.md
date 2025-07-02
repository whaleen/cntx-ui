## Relevant Files

- `.cntx/config.json` - Non-bundle configuration settings (editor preferences, etc.)
- `.cntx/bundle-states.json` - Single source of truth for all bundle definitions and metadata
- `lib/bundle-manager.js` - Core bundle management logic for processing and applying bundle rules
- `web/src/components/BundleList.tsx` - UI component for displaying and managing bundles
- `web/src/components/BundleDetails.tsx` - UI component for viewing individual bundle contents
- `lib/heuristics-manager.js` - Logic for automatic file categorization and bundle suggestions

### Notes

- This activity focuses on configuration and setup rather than code changes
- The agent will primarily work with JSON configuration files and provide guidance
- Bundle rules should be tested with sample files to ensure they work correctly
- Documentation should be clear enough for team members to understand and modify bundles

## Tasks

- [ ] 1.0 Project Analysis and Discovery
  - [ ] 1.1 Analyze project directory structure and identify main folders/modules
  - [ ] 1.2 Categorize existing files by type, purpose, and architectural layer
  - [ ] 1.3 Identify common patterns in file naming and organization
  - [ ] 1.4 Document project architecture and workflow patterns
- [ ] 2.0 Bundle Strategy Design
  - [ ] 2.1 Propose initial bundle structure based on project analysis
  - [ ] 2.2 Define bundle naming conventions and categorization rules
  - [ ] 2.3 Create bundle descriptions that explain their purpose and contents
  - [ ] 2.4 Validate bundle strategy with user and refine based on feedback
- [ ] 3.0 Bundle Configuration Implementation
  - [ ] 3.1 Create bundle definitions in .cntx/bundle-states.json with patterns and metadata
  - [ ] 3.2 **CRITICAL**: Use .cntx/bundle-states.json as single source of truth (no config.json bundle data)
  - [ ] 3.3 Set up automatic file categorization rules
  - [ ] 3.4 Configure bundle metadata (descriptions, tags, priorities)
  - [ ] 3.5 Test bundle rules with sample files to ensure proper categorization
- [ ] 4.0 Documentation and Refinement
  - [ ] 4.1 Document bundle purposes and use cases for team reference
  - [ ] 4.2 Create guidelines for adding new bundles or modifying existing ones
  - [ ] 4.3 Test bundle system with real project workflow scenarios
  - [ ] 4.4 Refine bundle structure based on usage patterns and feedback