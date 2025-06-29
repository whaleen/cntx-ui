# Heuristics Configuration Refactor - Tasks

## Task Breakdown

### 1. Extract Purpose Detection Heuristics
- **Status**: Todo
- **Description**: Extract hardcoded purpose detection patterns from semantic-splitter.js to heuristics-config.json
- **Files to modify**:
  - `lib/semantic-splitter.js` (extract `determinePurpose` function logic)
  - `heuristics-config.json` (add purpose patterns)
- **Acceptance criteria**:
  - All purpose detection logic moved to config
  - Semantic splitter reads from config instead of hardcoded rules
  - No behavioral changes to categorization

### 2. Extract Bundle Suggestion Logic
- **Status**: Todo
- **Description**: Extract bundle suggestion heuristics from BundleList.tsx to centralized config
- **Files to modify**:
  - `web/src/components/BundleList.tsx` (extract `suggestBundleForFile` function)
  - `heuristics-config.json` (add bundle suggestion patterns)
- **Acceptance criteria**:
  - Bundle suggestions work identically to before
  - Logic is data-driven from config
  - Maintains all existing bundle categorization behavior

### 3. Create HeuristicsManager Service
- **Status**: Todo
- **Description**: Build centralized service for loading and applying heuristics with caching and validation
- **Files to create**:
  - `lib/heuristics-manager.js`
- **Features**:
  - Config loading with validation
  - Caching for performance
  - File change detection and reload
  - Consistent API for all heuristic operations
- **Acceptance criteria**:
  - Service loads and validates heuristics config
  - Provides consistent interface for purpose detection and bundle suggestions
  - Handles config errors gracefully with fallbacks

### 4. Implement Heuristics API Endpoints
- **Status**: Todo
- **Description**: Create REST API for reading, updating, and managing heuristics configuration
- **Files to modify**:
  - `server.js` (add new endpoints)
- **Endpoints to create**:
  - `GET /api/heuristics` - retrieve current configuration
  - `POST /api/heuristics` - update configuration
  - `GET /api/heuristics/performance` - accuracy metrics
- **Acceptance criteria**:
  - APIs return proper JSON responses
  - Config updates are validated before applying
  - Performance metrics track categorization accuracy

### 5. Build Agent Activity Framework
- **Status**: Todo
- **Description**: Implement activity scheduler and execution system for agent-driven heuristics refinement
- **Files to create**:
  - `lib/activity-scheduler.js`
  - `lib/activity-executor.js`
- **Features**:
  - Activity definition and registration
  - Scheduled execution of heuristics refinement
  - Feedback collection from user corrections
  - Performance tracking and reporting
- **Acceptance criteria**:
  - Framework can load and execute activity definitions
  - Heuristics refinement activity can run automatically
  - System tracks and reports on categorization improvements

### 6. Verify Backward Compatibility
- **Status**: Todo
- **Description**: Ensure all existing functionality works identically after refactor
- **Testing requirements**:
  - All existing unit tests pass
  - Bundle generation produces identical output
  - Code categorization results unchanged
  - No performance regressions
- **Acceptance criteria**:
  - 100% functional compatibility verified
  - Performance benchmarks maintained
  - All edge cases handled properly

## Dependencies

- Task 1 and 2 can be done in parallel
- Task 3 depends on completion of tasks 1 and 2
- Task 4 depends on task 3
- Task 5 depends on task 4
- Task 6 should be done continuously throughout implementation

## Estimated Timeline

- **Task 1**: 2-3 days
- **Task 2**: 2-3 days  
- **Task 3**: 3-4 days
- **Task 4**: 2-3 days
- **Task 5**: 4-5 days
- **Task 6**: Ongoing

**Total estimated effort**: 2-3 weeks