# Bundle System Capabilities

## Overview
The bundle system provides logical organization of project files into meaningful groups. It offers structural understanding and efficient file navigation based on architectural boundaries.

## When Available
- Check for bundle endpoint: `GET /api/bundles`
- Look for bundle configuration files: `.cntx/bundle-states.json`
- Verify bundle status and organization

## Core Capabilities

### Bundle Listing
**Endpoint**: `GET /api/bundles`

**Provides**:
- Logical file groupings (frontend, backend, ui-components, etc.)
- File counts and sizes per bundle
- Bundle change status and metadata
- Last generation timestamps

### Bundle Content
**Endpoint**: `GET /api/bundles/{bundleName}`

**Returns**:
- Complete file contents for the bundle
- XML-formatted for easy parsing
- All files grouped logically together
- Ready for AI analysis or external tool consumption

### Bundle Regeneration
**Endpoint**: `GET /api/regenerate/{bundleName}`

**Use for**:
- Refreshing bundle contents after changes
- Ensuring up-to-date file organization
- Triggering bundle optimization

## Bundle Types and Purposes

### Common Bundle Patterns

#### Frontend Bundle
- **Contains**: React components, UI logic, client-side code
- **Typical files**: `src/components/*`, `src/pages/*`, `src/hooks/*`
- **Use for**: UI development, component discovery, frontend architecture

#### Backend Bundle  
- **Contains**: Server logic, API endpoints, business logic
- **Typical files**: `server.js`, `lib/*`, `api/*`
- **Use for**: API development, server architecture, business logic

#### UI Components Bundle
- **Contains**: Reusable UI components, design system elements
- **Typical files**: `src/components/ui/*`, shared components
- **Use for**: Component library management, design system work

#### Configuration Bundle
- **Contains**: Build configs, environment setup, tooling
- **Typical files**: `package.json`, `.env`, build scripts
- **Use for**: Project setup, deployment, tooling configuration

#### Documentation Bundle
- **Contains**: README files, documentation, guides
- **Typical files**: `*.md`, docs folders, guides
- **Use for**: Project understanding, onboarding, documentation updates

## Bundle-Aware Navigation

### Structural Understanding
Use bundles to understand:
- **Project architecture**: How code is organized conceptually
- **Responsibility boundaries**: What code belongs where
- **Development workflows**: Which files are typically modified together
- **Deployment units**: How code is packaged and shipped

### Scoped Exploration
- **Stay within bundle boundaries** when possible for focused work
- **Cross-reference bundles** when understanding system interactions
- **Use bundle context** to explain file relationships
- **Respect bundle organization** when suggesting file locations

### Bundle Relationships
- **Dependencies**: Which bundles depend on others
- **Interfaces**: How bundles communicate (APIs, exports, etc.)
- **Shared resources**: Common code used across bundles
- **Isolation**: Independent bundles that can be developed separately

## Integration with Other Systems

### Vector Search + Bundles
1. **Vector search** for semantic discovery
2. **Bundle context** for architectural understanding
3. **Combined insight** for complete picture

### Bundle-Guided Analysis
- Use bundle organization to scope vector searches
- Filter results by bundle boundaries when appropriate
- Provide bundle context with search results

## Performance Characteristics

### Speed
- **Bundle listing**: ~50ms
- **Bundle content**: Variable based on size (100ms-1s)
- **Token efficiency**: Medium (structured but can be large)

### Use Cases
- **Project overview**: Quick understanding of code organization
- **Architectural analysis**: How the system is structured
- **Focused development**: Working within specific domains
- **Code review**: Understanding change scope and impact

## Best Practices

### When to Use Bundles
- **Project orientation**: New developers understanding structure
- **Architectural decisions**: Planning where new code should go
- **Refactoring**: Understanding current organization before changes
- **Documentation**: Explaining project structure to others

### Bundle-First Approach
1. **Start with bundle overview** for project understanding
2. **Use bundle boundaries** to scope work appropriately
3. **Respect bundle organization** in recommendations
4. **Cross-reference bundles** when features span multiple areas

### Integration Patterns
- **Discovery**: Vector search → Bundle context → Specific files
- **Analysis**: Bundle structure → Semantic patterns → Implementation details
- **Planning**: Bundle boundaries → Feature scope → Implementation approach