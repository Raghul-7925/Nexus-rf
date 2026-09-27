# GSD Core Rules

## Workflow Discipline

You MUST follow the GSD (Git. Ship. Done.) spec-driven development framework for all non-trivial tasks. This ensures structured, high-quality output with persistent project memory.

## Phase Loop

For every milestone or significant feature, follow this five-step disciplined phase loop:

### 1. Discuss
- Define requirements and implementation decisions **before** planning.
- Clarify ambiguity, edge cases, and acceptance criteria with the user.
- Document decisions in `.planning/CONTEXT.md`.

### 2. Plan
- Research the codebase and decompose tasks into small, context-friendly units.
- Create a structured plan in `.planning/STATE.md` with clear milestones.
- Each task should fit within a fresh context window to avoid context rot.

### 3. Execute
- Carry out tasks one at a time, checking off items in `STATE.md`.
- Use fresh-context subagents for heavy tasks (research, large refactors).
- Keep the main session lean — delegate, don't accumulate.

### 4. Verify
- Run all relevant tests after each task.
- Diagnose gaps and generate fix plans before marking anything as done.
- Validate against the acceptance criteria defined in the Discuss phase.

### 5. Ship
- Finalize the work and update `.planning/continue-here.md` with next steps.
- Create commits with clear, descriptive messages.
- Archive the phase and prepare for the next milestone.

## Context Management

- **Avoid context rot**: Do not let conversation context grow unbounded. Delegate heavy operations to subagents.
- **Persistent memory**: Always maintain `.planning/` directory artifacts so work can be resumed across sessions.
- **State files**: Keep `STATE.md`, `CONTEXT.md`, and `continue-here.md` up to date at all times.

## Project Memory Files

| File | Purpose |
|---|---|
| `.planning/STATE.md` | Current milestone state, task checklist, progress |
| `.planning/CONTEXT.md` | Project context, decisions, architecture notes |
| `.planning/continue-here.md` | Resume point for next session |
