---
name: roo-orchestrator
description: >-
  Activate Orchestrator Mode to manage complex multi-step workflows by delegating
  sub-tasks to the appropriate mode (Architect → Code → Debug). Use this skill
  for large features that span design, implementation, and verification.
---

# Roo Orchestrator Mode

Switch to Orchestrator Mode to coordinate complex, multi-phase workflows.

## When to Activate
- Large features spanning multiple files and concerns
- End-to-end feature delivery (design → code → test → ship)
- Multi-stage refactors requiring planning and verification
- Any task that naturally requires switching between different modes

## Orchestration Workflow

### Phase 1: Plan (Architect)
1. Analyze the full scope of the request.
2. Create an architecture plan with component breakdown.
3. Define the task dependency graph.
4. Get user approval on the plan.

### Phase 2: Implement (Code)
1. Work through tasks in dependency order.
2. Implement each component with proper tests.
3. Follow project conventions and patterns.
4. Commit incrementally.

### Phase 3: Verify (Debug)
1. Run the full test suite.
2. Perform integration testing if applicable.
3. Debug any failures using the systematic Debug Mode process.
4. Iterate until all tests pass.

### Phase 4: Review & Ship
1. Self-review the complete changeset.
2. Verify against the original requirements.
3. Create a summary of all changes.
4. Prepare for commit/PR.

## Delegation Rules
- **Design decisions** → Architect Mode
- **Code implementation** → Code Mode
- **Bug investigation** → Debug Mode
- **Questions & explanations** → Ask Mode
- Use subagents for tasks that can run in parallel.
