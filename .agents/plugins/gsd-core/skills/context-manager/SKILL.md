---
name: gsd-context-manager
description: >-
  Manage persistent project memory across sessions using .planning/ artifacts.
  Use this skill when resuming work, starting a new session, or needing to
  understand prior project context.
---

# GSD Context Manager Skill

Manage the `.planning/` directory to maintain persistent project memory across sessions.

## Resuming a Session

1. Check if `.planning/continue-here.md` exists.
2. If yes, read it to understand:
   - What was last completed
   - What the next steps are
   - Any open issues
3. Read `.planning/STATE.md` for the current milestone status.
4. Read `.planning/CONTEXT.md` for project decisions and architecture notes.
5. Present a summary to the user and confirm the next action.

## Creating Fresh Context

If `.planning/` does not exist:

1. Create the directory structure:
   ```
   .planning/
   ├── STATE.md
   ├── CONTEXT.md
   └── continue-here.md
   ```
2. Initialize `CONTEXT.md` with project overview based on codebase analysis.
3. Initialize `STATE.md` with the current task breakdown.

## Updating State

After completing any significant work:

1. Update task checkboxes in `STATE.md`.
2. Add new decisions or learnings to `CONTEXT.md`.
3. Update `continue-here.md` with the current resume point.
