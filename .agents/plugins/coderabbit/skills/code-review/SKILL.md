---
name: coderabbit-review
description: >-
  Perform a comprehensive AI-powered code review on recent changes. Use this
  skill to review code for correctness, security, performance, and quality
  before shipping. Acts as a thorough senior engineer reviewer.
---

# CodeRabbit Code Review Skill

Perform a thorough, context-aware code review on the current changes.

## How to Review

### Step 1: Identify Changes
1. Run `git diff` or `git diff --staged` to identify what changed.
2. If reviewing a specific file, read the full file for context.
3. Understand the intent of the change from commit messages or user description.

### Step 2: Analyze Each Dimension

#### Correctness ⛔
- Check for logic errors, off-by-one, null handling
- Verify edge cases and boundary conditions
- Ensure proper error handling and type safety
- Check resource management (leaks, unclosed handles)

#### Security 🔒
- Input validation and sanitization
- Injection vulnerabilities (SQL, XSS, CSRF)
- Secrets or credentials in code
- Dependency security (known CVEs)
- Auth/authz checks

#### Performance ⚡
- Unnecessary computations or re-renders
- N+1 queries, missing indexes
- Memory-intensive operations
- Caching opportunities

#### Code Quality 📐
- DRY violations and duplication
- Function complexity and length
- Naming and readability
- Separation of concerns
- Project convention adherence

#### Breaking Changes 💥
- API contract changes
- Database schema changes
- Public interface modifications
- Dependency version bumps

### Step 3: Format the Review

Structure your review as:

```markdown
## Code Review Summary

**Change**: [One-line description]
**Files**: [List of files reviewed]
**Verdict**: ✅ Approve / ⚠️ Approve with suggestions / ⛔ Request changes

### Critical Issues ⛔
- [Issue with file:line reference and fix suggestion]

### Suggestions 💡
- [Improvement with rationale]

### Nitpicks 🔍
- [Minor style/convention note]

### Praise ✅
- [Well-written code worth highlighting]
```

### Step 4: Provide One-Click Fixes
For each critical issue and suggestion, provide the exact code fix that can be applied directly.

## Incremental Reviews
When reviewing follow-up commits, focus only on the delta. Reference prior review findings if issues remain unresolved.
