# Create Project Bundles with Agent Assistance

## Introduction/Overview

Set up organized bundles for a new codebase using agent assistance to analyze project structure and suggest appropriate file groupings. This activity demonstrates how to collaborate with an AI agent to understand your project's architecture and create meaningful bundles for efficient context management and LLM consumption.

## Goals

- Analyze project structure and identify logical file groupings
- Create bundles that reflect the project's architecture and workflow
- Establish bundle naming conventions and categorization rules
- Set up automated bundle suggestions for future file additions
- Document bundle purposes and contents for team understanding

## User Stories

- As a developer, I want an agent to analyze my codebase so that I can understand how to organize files into logical bundles
- As a developer, I want suggested bundle structures so that I don't have to manually categorize every file
- As a team member, I want clear bundle documentation so that I understand the project organization
- As a developer, I want bundle rules that adapt to my project so that new files are automatically categorized appropriately

## Functional Requirements

1. The system must analyze the existing project structure and file types
2. The system must suggest logical bundle groupings based on project architecture
3. The system must create bundle configuration files with clear naming and descriptions
4. **CRITICAL**: The system must update .cntx/bundle-states.json as the single source of truth for bundle definitions
5. The system must establish rules for automatic file categorization
6. The system must generate documentation explaining each bundle's purpose
7. The system must allow iterative refinement of bundle structure based on user feedback
8. The system must integrate with the existing cntx-ui bundle management system

## Non-Goals (Out of Scope)

- Modifying existing project files or structure
- Creating complex custom bundling algorithms
- Handling projects with unusual or highly specialized architectures
- Setting up advanced semantic analysis beyond basic file categorization

## Design Considerations

- Follow existing cntx-ui bundle configuration patterns
- Use clear, intuitive bundle names that reflect project concepts
- Consider both technical structure (frontend/backend) and functional structure (features/components)
- Balance bundle granularity - not too many small bundles, not too few large ones
- Account for common development workflows and contexts

## Technical Considerations

- Leverage existing cntx-ui bundle management and configuration systems
- Use file path analysis and naming patterns for initial categorization
- Consider integration with semantic analysis for content-based grouping
- Ensure bundle configurations are easily editable and maintainable
- Account for different project types (React, Node.js, full-stack, etc.)

## Success Metrics

- Complete bundle coverage of project files with logical groupings
- Clear bundle documentation that team members can understand
- Automated bundle suggestions that are 80%+ accurate for new files
- Reduced time to find relevant files when working on specific features
- Improved context efficiency when using bundled files with LLMs

## Open Questions

- What level of bundle granularity works best for different project sizes?
- How should bundles handle cross-cutting concerns like utilities and shared components?
- Should bundles be organized by technical layers or business features?
- How can bundle rules adapt as the project evolves?

## Status

- **Current Status**: Todo
- **Priority**: High
- **Estimated Effort**: Small
- **Dependencies**: Existing cntx-ui bundle management system

## Related Files

- `.cntx/config.json` - Non-bundle configuration settings (editor, etc.)
- `.cntx/bundle-states.json` - Single source of truth for all bundle definitions
- `lib/bundle-manager.js` - Bundle management logic
- `lib/configuration-manager.js` - Configuration and bundle state management
- `web/src/components/BundleList.tsx` - Bundle UI components