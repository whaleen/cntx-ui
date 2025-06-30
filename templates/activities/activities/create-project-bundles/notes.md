# Notes: Create Project Bundles with Agent Assistance

## Overview

This document captures ongoing thoughts, insights, and reference information related to creating project bundles with agent assistance.

## Agent Collaboration Tips

### Effective Prompts for Bundle Creation
- "Analyze my project structure and suggest logical file groupings"
- "Help me understand which files should be bundled together for [specific feature/workflow]"
- "Review these bundle suggestions and recommend improvements"
- "Create bundle rules that will automatically categorize files like [example files]"

### Questions to Ask Your Agent
- What architectural patterns do you see in this codebase?
- How would you group these files for efficient context switching?
- What bundle structure would work best for a team of [X] developers?
- Can you suggest rules for automatically categorizing new files?

## Bundle Strategy Notes

### Common Bundle Patterns
- **By Architecture Layer:** frontend, backend, database, api
- **By Feature:** user-auth, payment-system, dashboard, reports  
- **By Component Type:** ui-components, pages, hooks, utilities
- **By Development Phase:** core, features, testing, deployment

### Bundle Naming Guidelines
- Use clear, descriptive names that reflect content
- Avoid technical jargon that team members might not understand
- Consider using consistent prefixes (ui-, api-, lib-, etc.)
- Keep names short but meaningful

## Project-Specific Considerations

### Codebase Characteristics
_Document specific aspects of your project that affect bundle organization_

### Team Workflow
_Note how your team works with files and what bundle structure would support their workflow_

### Future Growth
_Consider how bundle structure should accommodate project expansion_

## Reference Examples

### Sample Bundle Configurations

**bundles.json** (detailed metadata):
```json
{
  "name": "ui-components",
  "description": "Reusable UI components and design system elements",
  "patterns": ["src/components/**/*.tsx", "src/ui/**/*.tsx"],
  "exclude": ["**/*.test.tsx", "**/*.stories.tsx"],
  "tags": ["ui", "components"],
  "priority": 1
}
```

**config.json** (tracking patterns):
```json
{
  "bundles": {
    "ui-components": [
      "src/components/**/*.tsx",
      "src/ui/**/*.tsx",
      "!**/*.test.tsx",
      "!**/*.stories.tsx"
    ]
  }
}
```

⚠️ **CRITICAL**: Both files must be updated for bundles to appear in the UI!

### File Organization Patterns
- Component files: Component.tsx, Component.test.tsx, Component.stories.tsx
- Page files: pages/[route]/index.tsx, pages/[route]/components/
- API files: api/[endpoint]/route.ts, api/[endpoint]/types.ts

## Useful Commands

### Analyzing Project Structure
```bash
# Get overview of project structure
tree -I 'node_modules|dist|build' -L 3

# Count files by type
find . -name "*.tsx" | wc -l
find . -name "*.ts" | wc -l
```

### Bundle Testing
```bash
# Test bundle generation
cntx-ui bundle --name ui-components --dry-run

# View bundle contents
cntx-ui status --verbose
```