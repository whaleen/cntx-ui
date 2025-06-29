# Heuristics Configuration Refactor - Notes

## Architecture Decisions

### Configuration Format
- **Choice**: JSON format for heuristics configuration
- **Rationale**: Human-readable, easily parsed by agents, supports nested structures
- **Alternative considered**: YAML (rejected due to parsing complexity for agents)

### Service Architecture
- **Choice**: Centralized HeuristicsManager service
- **Rationale**: Single source of truth, consistent caching, unified API
- **Pattern**: Singleton service with lazy loading and file watching

### API Design
- **Choice**: RESTful endpoints under `/api/heuristics`
- **Rationale**: Follows existing cntx-ui API patterns, familiar to developers
- **Security**: Input validation and sanitization for all config updates

## Implementation Notes

### Current Heuristics Locations
1. **Purpose Detection**: `lib/semantic-splitter.js` lines 528-542
   - Simple string matching patterns
   - Function type-based rules
   - Fallback to "Utility function"

2. **Bundle Suggestions**: `web/src/components/BundleList.tsx` lines 58-100
   - Path-based pattern matching
   - File extension rules
   - Hierarchical suggestion logic

3. **Semantic Type Clustering**: `web/src/components/VectorVisualization.tsx` lines 182-218
   - Type-to-cluster-ID mapping
   - Used for visualization grouping

### Key Patterns Identified
- **Path-based rules**: Most heuristics use file path patterns
- **Name-based rules**: Function/variable name substring matching
- **Type-based rules**: React component, function type detection
- **Fallback logic**: Default categorization when no patterns match

### Agent Integration Points
- **Feedback collection**: Track user corrections to heuristics
- **Performance monitoring**: Accuracy metrics for each heuristic rule
- **Confidence scoring**: Statistical confidence in categorization decisions
- **Learning triggers**: Automatic refinement when accuracy drops

## Technical Considerations

### Performance
- **File watching**: Use `fs.watch()` for config change detection
- **Caching strategy**: In-memory cache with TTL and invalidation
- **Lazy loading**: Load config only when needed, not at startup

### Error Handling
- **Config validation**: JSON schema validation on load
- **Graceful degradation**: Fall back to hardcoded rules if config fails
- **Error logging**: Detailed logging for debugging heuristics issues

### Testing Strategy
- **Unit tests**: Test HeuristicsManager in isolation
- **Integration tests**: Verify end-to-end categorization behavior
- **Performance tests**: Benchmark config-based vs hardcoded performance
- **Regression tests**: Ensure identical behavior after refactor

## Future Enhancements

### Agent Capabilities
- **Pattern discovery**: Agents analyze codebase to find new heuristic patterns
- **A/B testing**: Test new heuristics against subset of files
- **Confidence learning**: Machine learning to improve confidence scores
- **Collaborative filtering**: Learn from multiple project patterns

### Advanced Features
- **Conditional rules**: Context-dependent heuristic application
- **Rule priorities**: Weighted scoring for conflicting heuristics
- **Custom rules**: User-defined project-specific heuristics
- **Rule analytics**: Detailed statistics on heuristic effectiveness

## Risk Mitigation

### Backward Compatibility
- **Comprehensive testing**: Test against existing bundle outputs
- **Gradual rollout**: Feature flags for config-based vs hardcoded
- **Rollback plan**: Ability to disable config system if issues arise

### Configuration Management
- **Version control**: Track config changes with git
- **Backup strategy**: Automatic config backups before agent updates
- **Validation**: Strict schema validation to prevent corruption

### Agent Safety
- **Rate limiting**: Prevent agents from making too many config changes
- **Change approval**: Human review of significant heuristic changes
- **Sandboxing**: Test agent changes in isolated environment first