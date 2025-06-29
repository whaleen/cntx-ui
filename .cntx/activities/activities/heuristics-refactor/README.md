# Activity: Heuristics Configuration Refactor

## Introduction/Overview

This activity transforms cntx-ui's hardcoded heuristics into a configurable, agent-manageable system. Currently, code categorization logic (purpose detection, bundle suggestions, semantic type mapping) is scattered across multiple files as hardcoded rules. This refactor extracts all heuristics into a centralized configuration system that agents can read, modify, and improve automatically.

The goal is to create a foundation for intelligent agent activities while maintaining all existing functionality and enabling future AI-driven improvements to code categorization accuracy.

## Goals

1. **Extract all hardcoded heuristics** from the codebase into the centralized `heuristics-config.json`
2. **Create HeuristicsManager service** for consistent heuristics loading and application
3. **Build API endpoints** for heuristics management and agent integration
4. **Implement agent activity framework** with hooks for heuristics refinement
5. **Maintain 100% functional compatibility** - no behavior changes for end users
6. **Enable real-time heuristics updates** without code deployments
7. **Establish foundation** for future agent-driven accuracy improvements

## User Stories

**As a developer using cntx-ui:**
- I want code categorization to work exactly as before, so my workflow isn't disrupted
- I want to be able to customize heuristics for my specific project needs
- I want the system to get smarter over time without manual intervention

**As an AI agent:**
- I want to analyze heuristics performance and identify improvement opportunities
- I want to update heuristics rules based on user corrections and feedback
- I want to track confidence scores and success rates for different categorization patterns

**As a cntx-ui maintainer:**
- I want heuristics logic centralized and easily maintainable
- I want to see clear metrics on categorization accuracy
- I want agents to automatically refine the system based on real usage data

## Functional Requirements

1. **Heuristics Extraction**
   1.1. Extract purpose detection patterns from `lib/semantic-splitter.js`
   1.2. Extract bundle suggestion logic from `web/src/components/BundleList.tsx`
   1.3. Extract semantic type clustering from `web/src/components/VectorVisualization.tsx`
   1.4. Identify and extract any other heuristic patterns across the codebase

2. **HeuristicsManager Service**
   2.1. Create centralized service to load and apply heuristics from config
   2.2. Implement caching for performance with config change detection
   2.3. Provide consistent API for all heuristic operations
   2.4. Support confidence scoring and pattern matching

3. **API Integration**
   3.1. Create GET `/api/heuristics` endpoint to retrieve current configuration
   3.2. Create POST `/api/heuristics` endpoint to update configuration
   3.3. Create GET `/api/heuristics/performance` endpoint for accuracy metrics
   3.4. Add validation for heuristics configuration updates

4. **Agent Activity Framework**
   4.1. Define activity structure for heuristics refinement tasks
   4.2. Create activity scheduler and execution system
   4.3. Implement feedback collection from user corrections
   4.4. Build performance tracking and reporting system

5. **Backward Compatibility**
   5.1. All existing functionality must work identically
   5.2. No changes to user-facing behavior or UI
   5.3. Performance must be maintained or improved
   5.4. Graceful fallback if config is corrupted or missing

6. **Configuration Management**
   6.1. Validate heuristics config on load with clear error messages
   6.2. Support config versioning and migration
   6.3. Implement config backup and rollback capabilities
   6.4. Add logging for all heuristics operations

## Non-Goals (Out of Scope)

- **UI changes** - No modifications to existing user interfaces
- **New categorization types** - Focus on existing heuristics, not new ones
- **Machine learning models** - Use rule-based heuristics, not AI models
- **Real-time learning** - Agent refinement runs as scheduled activities, not live
- **Performance optimization** - Maintain current performance, optimization is separate activity

## Design Considerations

- **Follow existing cntx-ui patterns** for service architecture and API design
- **Use existing shadcn/ui components** if any configuration UI is needed later
- **Maintain JSON-based configuration** for human readability and agent manipulation
- **Consistent with current bundle and semantic systems** - integrate, don't replace

## Technical Considerations

- **Config loading performance** - Cache in memory, watch for file changes
- **Atomic updates** - Validate entire config before applying changes
- **Error handling** - Graceful degradation if heuristics fail
- **Agent security** - Validate all agent-generated config updates
- **Database integration** - Consider storing performance metrics in existing systems
- **TypeScript interfaces** - Strong typing for all heuristics structures

## Success Metrics

- **100% functional compatibility** - All existing tests pass without modification
- **Performance maintained** - No measurable performance regression
- **Configuration completeness** - All hardcoded heuristics extracted successfully
- **API responsiveness** - Heuristics endpoints respond in <100ms
- **Agent integration ready** - Framework can execute sample heuristics refinement activity
- **Code quality** - TypeScript types, error handling, and logging implemented

## Open Questions

1. **Config storage location** - Keep in JSON file or move to database for concurrent agent access?
2. **Activity scheduling** - How frequently should agents run heuristics refinement?
3. **User override system** - Should users be able to manually override agent suggestions?
4. **Performance monitoring** - What metrics should we track for heuristics effectiveness?
5. **Rollback strategy** - How should we handle config updates that reduce accuracy?
6. **Multi-agent coordination** - How do multiple agents coordinate heuristics improvements?

## Implementation Notes

This is a foundational refactor that enables the future agent-driven evolution of cntx-ui. The focus is on creating robust infrastructure while maintaining complete backward compatibility. Success means users see no changes, but the system becomes dramatically more intelligent and self-improving over time.