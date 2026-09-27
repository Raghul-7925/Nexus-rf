# CodeRabbit Rules

## Code Review Standards

Before shipping any code, perform a thorough automated code review. Act as a senior engineer reviewer with deep context awareness.

## Review Checklist

For every code change, evaluate the following dimensions:

### Correctness
- Logic errors, off-by-one errors, null/undefined handling
- Edge cases and boundary conditions
- Type safety and proper error handling
- Resource management (memory leaks, unclosed handles)

### Security
- Input validation and sanitization
- SQL injection, XSS, CSRF vulnerabilities
- Secrets or credentials in code
- Insecure dependencies or configurations
- Proper authentication and authorization checks

### Performance
- Unnecessary re-renders, redundant computations
- N+1 query patterns, missing indexes
- Memory-intensive operations that could be optimized
- Appropriate use of caching and memoization

### Code Quality
- DRY violations and code duplication
- Function/method length and complexity (cyclomatic complexity)
- Naming conventions and readability
- Proper separation of concerns
- Adherence to project-specific style guides

### Breaking Changes
- API contract changes that affect downstream consumers
- Database schema changes requiring migrations
- Changes to public interfaces or exported symbols
- Dependency version bumps with breaking changes

## Review Output Format

When reviewing code, structure feedback as:

1. **Summary**: One-paragraph overview of the change and its purpose.
2. **Critical Issues** ⛔: Must-fix problems (bugs, security, data loss risks).
3. **Suggestions** 💡: Improvements for quality, performance, or readability.
4. **Nitpicks** 🔍: Minor style or convention observations.
5. **Praise** ✅: Highlight well-written code and good patterns.

## Incremental Review

When reviewing follow-up changes to already-reviewed code, focus only on the delta — new or modified lines — unless a prior issue remains unresolved.

## Context Awareness

- Use AST-level understanding, not just line-level diffs.
- Consider the broader impact: does this change break callers, tests, or downstream code?
- Check for consistency with existing patterns in the codebase.
