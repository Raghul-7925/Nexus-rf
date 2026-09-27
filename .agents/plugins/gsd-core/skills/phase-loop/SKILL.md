---
name: gsd-phase-loop
description: >-
  Execute the GSD five-step phase loop (Discuss → Plan → Execute → Verify → Ship)
  for structured, spec-driven development. Use this skill for any non-trivial task
  that requires planning and milestone tracking.
---

# GSD Phase Loop Skill

Run the complete GSD (Git. Ship. Done.) five-step development cycle for the current task.

## Prerequisites

Ensure the `.planning/` directory exists in the project root. If not, create it.

## Steps

### Step 1: Discuss
1. Review the user's request and identify all requirements.
2. Ask clarifying questions for any ambiguous requirements.
3. Document agreed decisions in `.planning/CONTEXT.md`:
   ```markdown
   # Project Context
   ## Decisions
   - [Decision 1]
   - [Decision 2]
   ## Requirements
   - [Requirement 1]
   - [Requirement 2]
   ```

### Step 2: Plan
1. Research the codebase to understand existing architecture.
2. Decompose the task into small, focused sub-tasks.
3. Create/update `.planning/STATE.md`:
   ```markdown
   # Current Milestone: [Name]
   ## Tasks
   - [ ] Task 1
   - [ ] Task 2
   - [ ] Task 3
   ## Status: IN PROGRESS
   ```

### Step 3: Execute
1. Work through each task in `STATE.md` sequentially.
2. Mark tasks as `[x]` when completed.
3. For heavy tasks, delegate to subagents to preserve context freshness.
4. Commit completed work with clear messages.

### Step 4: Verify
1. Run all project tests: `npm test`, `pytest`, `go test`, etc.
2. Manually verify the output matches acceptance criteria.
3. If issues are found, create a fix plan and return to Execute.

### Step 5: Ship
1. Update `.planning/continue-here.md` with:
   ```markdown
   # Continue Here
   ## Last Completed
   - [What was done]
   ## Next Steps
   - [What to do next]
   ## Open Issues
   - [Any remaining items]
   ```
2. Create final commit and summarize the milestone.
