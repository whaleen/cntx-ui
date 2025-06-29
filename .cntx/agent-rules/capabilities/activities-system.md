# Activities System Capabilities

## Overview
The activities system provides structured task management for agents, tracking progress on complex development activities through defined workflows and documentation.

## When Available
- Check for activities endpoint: `GET /api/activities`
- Look for activities directory: `.cntx/activities/activities/`
- Verify activity definitions and progress tracking

## Core Capabilities

### Activity Discovery
**Endpoint**: `GET /api/activities`

**Provides**:
- List of all available activities
- Activity status and progress percentages
- Activity metadata (name, description, category)
- Complete file contents (README, progress, tasks, notes)

### Activity Execution (Future)
**Endpoints**: 
- `POST /api/activities/{id}/execute` (planned)
- `POST /api/activities/{id}/stop` (planned)

**Will provide**:
- Programmatic activity execution
- Progress monitoring and updates
- Result collection and reporting

## Activity Structure

### Standard Activity Format
Each activity contains:
- **README.md**: Activity definition, goals, requirements
- **progress.md**: Current status, completion tracking
- **tasks.md**: Detailed task breakdown with priorities
- **notes.md**: Implementation decisions, technical notes

### Activity Metadata
- **Status**: pending, in_progress, completed, failed
- **Progress**: Percentage completion (0-100%)
- **Category**: Type of activity (refactoring, feature, analysis, etc.)
- **Priority**: Task importance (high, medium, low)

## Activity Types and Use Cases

### Development Activities
- **Feature implementation**: Adding new functionality
- **Refactoring**: Code organization and cleanup
- **Migration**: Technology or pattern updates
- **Optimization**: Performance and efficiency improvements

### Analysis Activities
- **Architecture review**: System design evaluation
- **Code analysis**: Pattern discovery and documentation
- **Dependency audit**: Library and framework assessment
- **Security review**: Vulnerability analysis

### Maintenance Activities
- **Documentation updates**: Keeping docs current
- **Test coverage**: Ensuring adequate testing
- **Cleanup tasks**: Removing deprecated code
- **Configuration updates**: Settings and environment management

## Progress Tracking

### Status Indicators
- **✅ Completed**: Task finished successfully
- **🚧 In Progress**: Currently being worked on
- **⏳ Pending**: Not yet started
- **❌ Failed**: Encountered blocking issues

### Progress Calculation
Based on task completion percentages from tasks.md:
- Parse task status indicators
- Calculate completion ratio
- Update overall activity progress
- Track progress over time

### Completion Criteria
Activities are considered complete when:
- All defined tasks are finished
- Success criteria are met
- Documentation is updated
- Results are validated

## Agent Integration

### Activity-Driven Development
Agents can use activities to:
- **Structure complex work**: Break down large tasks into manageable pieces
- **Track progress**: Monitor completion status and identify blockers
- **Coordinate effort**: Understand what work is planned vs in progress
- **Learn from context**: Use existing activities as templates

### Activity Creation Process
1. **Define goals**: Clear objectives and success criteria
2. **Break down tasks**: Specific, actionable work items
3. **Estimate effort**: Time and complexity assessments
4. **Track progress**: Regular status updates and milestone tracking
5. **Document results**: Lessons learned and outcomes

### Progress Monitoring
- **Real-time updates**: Activity status reflects current work
- **Milestone tracking**: Key progress points and deliverables
- **Blocker identification**: Issues preventing progress
- **Completion validation**: Ensuring work meets requirements

## Integration with Other Systems

### Vector Search + Activities
- Use vector search to find activity-related code
- Reference activities in code discovery and explanation
- Connect implementation work to activity goals

### Bundle System + Activities
- Scope activities by bundle boundaries
- Use bundle organization to plan activity tasks
- Track activity impact across bundle boundaries

## Performance Characteristics

### Speed
- **Activity listing**: ~30ms
- **Activity details**: ~50ms (includes file contents)
- **Token efficiency**: High (structured, relevant content)

### Use Cases
- **Project planning**: Understanding planned and ongoing work
- **Context switching**: Quickly understanding current development state
- **Progress reporting**: Communicating status to stakeholders
- **Knowledge transfer**: Sharing implementation context and decisions

## Best Practices

### Activity-Aware Assistance
- **Check activity context** when helping with development tasks
- **Reference related activities** when explaining code or suggesting changes
- **Respect activity boundaries** and existing work in progress
- **Contribute to activity documentation** when making related changes

### Integration Patterns
- **Planning**: Activities → Bundle scope → Vector search → Implementation
- **Execution**: Activity tasks → Code discovery → Implementation → Progress update
- **Review**: Activity completion → Validation → Documentation → Lessons learned