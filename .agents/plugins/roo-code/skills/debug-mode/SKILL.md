---
name: roo-debug
description: >-
  Activate Debug Mode for systematic troubleshooting and bug investigation.
  Use this skill when tracing bugs, analyzing error messages, diagnosing test
  failures, or performing root cause analysis.
---

# Roo Debug Mode

Switch to Debug Mode for systematic, hypothesis-driven troubleshooting.

## When to Activate
- Tracing bugs and unexpected behavior
- Analyzing error messages and stack traces
- Diagnosing test failures
- Performance issue investigation
- Root cause analysis

## Debugging Process

### Step 1: Reproduce
- Identify the exact steps or conditions that trigger the issue.
- Document the expected vs actual behavior.
- Determine if the issue is deterministic or intermittent.

### Step 2: Hypothesize
- Form 2-3 hypotheses about the root cause.
- Rank them by likelihood based on available evidence.
- Identify what evidence would confirm or refute each hypothesis.

### Step 3: Investigate
- Add targeted diagnostic logging or print statements.
- Inspect relevant state (variables, database, network).
- Check recent changes (git log, git diff) that may have introduced the issue.
- Narrow down the scope using binary search (bisect).

### Step 4: Fix
- Apply the most targeted fix possible.
- Avoid shotgun debugging — never change multiple things at once.
- Explain WHY the fix works, not just WHAT it changes.

### Step 5: Verify
- Confirm the fix resolves the original issue.
- Run the full test suite to check for regressions.
- Verify edge cases related to the fix.
- Consider adding a regression test.

## Anti-Patterns to Avoid
- ❌ Applying fixes without understanding root cause
- ❌ Changing multiple variables simultaneously
- ❌ Ignoring test failures after "fixing" the bug
- ❌ Cargo-cult debugging (copying fixes from Stack Overflow without understanding them)
