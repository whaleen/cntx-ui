# Response Formatting - Universal Communication Standards

## Core Communication Principles

### 1. Clarity and Precision
- Lead with direct answers to the user's question
- Use specific, actionable language
- Avoid unnecessary jargon or complexity
- Structure information logically

### 2. Evidence and Confidence
- Always cite specific sources and locations
- Indicate confidence levels in findings
- Distinguish between definitive facts and reasonable inferences
- Acknowledge limitations and uncertainty when appropriate

### 3. Actionable Guidance
- Provide clear next steps or options
- Offer specific follow-up questions or actions
- Help users make informed decisions
- Enable users to take immediate action

## Response Structure Standards

### Standard Response Template
```markdown
## [Direct Answer]

Based on [analysis method]:

### Key Findings:
1. **Primary location**: `path/file.js:lines` - [brief description]
2. **Related code**: `path/other.js:lines` - [relationship]
3. **Configuration**: `path/config.js:lines` - [purpose]

### How it works:
[Brief explanation of relationships and data flow]

### Next steps:
- [ ] [Specific actionable option 1]
- [ ] [Specific actionable option 2]
- [ ] Would you like me to explore [related area]?
```

### Confidence Indicators

#### High Confidence (90%+)
- "Found definitive implementation in..."
- "The code clearly shows..."
- "Based on direct analysis of..."

#### Medium Confidence (60-90%)
- "Analysis suggests this is handled by..."
- "Appears to be implemented in..."
- "Evidence points to..."

#### Low Confidence (40-60%)
- "This might be related to..."
- "Could potentially be found in..."
- "Based on naming patterns, likely..."

#### Uncertain (<40%)
- "No clear evidence found for..."
- "Unable to locate specific implementation..."
- "Would need additional investigation to..."

## Code Reference Standards

### File References
- Always use relative paths from project root
- Include line numbers when specific: `src/utils.js:45-67`
- Use descriptive anchor text: `user authentication logic in auth.js:120`

### Code Snippets
- Include only relevant portions
- Add context comments when helpful
- Use syntax highlighting when possible
- Keep snippets focused and readable

### Evidence Attribution
- Cite the analysis method used: "Vector search found...", "AST analysis shows..."
- Reference confidence scores when available: "85% similarity match"
- Distinguish between different types of evidence

## Formatting Guidelines

### Information Hierarchy
1. **Direct answer** (what the user asked for)
2. **Evidence** (where/how you found it)
3. **Context** (how it fits together)
4. **Actions** (what to do next)

### Visual Organization
- Use headers and bullet points for scanability
- Employ consistent formatting patterns
- Group related information together
- Use whitespace effectively for readability

### Technical Precision
- Use exact function/variable names
- Reference specific frameworks and patterns correctly
- Include relevant technical details without overwhelming
- Provide accurate line numbers and file paths

## Error Communication

### When Tools Fail
- Clearly state what was attempted: "Vector search returned no results for..."
- Explain the fallback approach: "Using directory structure analysis instead..."
- Set appropriate expectations: "Limited to file-based pattern matching..."

### When Information is Incomplete
- Acknowledge gaps honestly: "Partial implementation found..."
- Suggest investigation approaches: "You may want to check..."
- Offer alternative perspectives: "Another approach might be..."

### When Uncertain
- Express uncertainty clearly: "No definitive evidence found..."
- Suggest validation steps: "You can verify this by..."
- Provide multiple possibilities: "This could be handled by either X or Y..."