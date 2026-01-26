---
description: Generates a technical implementation blueprint from an approved PRD. Maps concepts to code—schema, components, and execution order.
---

# WORKFLOW: FEATURE BLUEPRINT

**Role**: Technical Architect
**Goal**: Transform an approved PRD into an actionable implementation plan. Define the "How".

> **Prerequisite**: A PRD must be approved before running this workflow. If no PRD exists, run `/generate_prd` first.

---

## Phase 1: PRD Review

1. **Locate the PRD**:
   - Check `specs/prd-[feature-name].md`
   - If no PRD exists: STOP and direct the user to run `/generate_prd` first

2. **Validate Readiness**:
   - Confirm the PRD has been marked as APPROVED
   - Review all sections: Objective, User Stories, Business Rules, Data Requirements

3. **Extract Implementation Signals**:
   - User Stories → UI flows and entry points
   - Business Rules → Validation logic and constraints
   - Data Requirements → Schema considerations
   - Out of Scope → What NOT to build

---

## Phase 2: Technical Interrogation

Ask 3-5 questions to clarify architecture decisions. Focus on implementation concerns.

**Example Questions**:
- **State Management**: Will this use local state, global state, or URL state (searchParams)?
- **Data Flow**: Server-side rendering, client-side fetching, or hybrid?
- **Schema Impact**: Does this require new tables, columns, or relationships?
- **Reusability**: Which existing components or utilities can we leverage?
- **Dependencies**: Are there external libraries or APIs involved?

**Wait for Answers**: Do not proceed until the user responds.

---

## Phase 3: Codebase Analysis

Before designing, understand the current state.

1. **Explore Relevant Areas**:
   - Identify files/folders that will be impacted
   - Review existing patterns for similar features
   - Check for reusable components, hooks, or utilities

2. **Identify Constraints**:
   - Tech stack limitations
   - Existing architectural patterns to follow
   - Performance considerations

---

## Phase 4: Generate the Blueprint

Create a file at `specs/blueprint-[feature-name].md` using the template below.

### Blueprint Template

```markdown
# Blueprint: [Feature Name]

**PRD Reference**: `specs/prd-[feature-name].md`
**Status**: Draft | APPROVED
**Date**: YYYY-MM-DD

## 1. Overview
Brief technical summary of what we're building.

## 2. Architecture Decision

### Approach
- Describe the chosen technical approach
- Why this approach over alternatives

### Tech Stack Components
- List specific technologies/libraries used for this feature

## 3. Data Layer

### Schema Changes
```
[Database schema changes, migrations, or model definitions]
```

### Data Flow
- How data moves through the system
- API endpoints or server actions needed

## 4. Component Structure

### New Components
| Component | Location | Purpose |
|-----------|----------|---------|
| ... | `src/components/...` | ... |

### Modified Components
| Component | Changes |
|-----------|---------|
| ... | ... |

## 5. Business Logic

### Validation Rules
- Rule 1: Implementation approach
- Rule 2: Implementation approach

### Error Handling
- How errors are caught, logged, and displayed

## 6. Implementation Plan

### File-by-File Execution Order
1. `path/to/file.ts` — Description of changes
2. `path/to/file.ts` — Description of changes
3. ...

### Dependencies
- [ ] Prerequisite 1
- [ ] Prerequisite 2

## 7. Testing Strategy
- Unit tests needed
- Integration tests needed
- Manual testing checklist

## 8. Risks & Mitigations
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| ... | Low/Med/High | ... |
```

---

## Phase 5: Review & Approval

1. Present the Blueprint to the user
2. Ask: **"Does this blueprint accurately reflect how we should build this? Reply APPROVED to begin implementation."**
3. If **APPROVED**: Proceed to implementation
4. If **NOT APPROVED**: Iterate based on feedback

---

## Summary: PRD → Blueprint → Implementation

| Phase | Workflow | Focus | Gate |
|-------|----------|-------|------|
| 1 | `/generate_prd` | What & Why | User says APPROVED |
| 2 | `/feature_blueprint` | How | User says APPROVED |
| 3 | Implementation | Build it | — |
