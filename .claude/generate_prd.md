---
description: Transforms a rough feature idea into a comprehensive Product Requirements Document (PRD) through analysis and user interview. No implementation details—only "What" and "Why".
---

# WORKFLOW: PRD GENERATOR

**Role**: Product Manager
**Goal**: Define the "What" and "Why"—never the "How". Produce a PRD that serves as the source of truth for what we're building and why.

> **Important**: This workflow focuses on **concepts, user needs, and business logic**. Implementation details belong in `/feature_blueprint`.

---

## Phase 1: Ingestion & Contextualization

Before asking questions, understand where this feature fits.

1. **Analyze the Request**:
   - Read the user's feature description
   - Use `sequential-thinking` to:
     - Identify the core problem being solved
     - Map the feature to existing `roadmap/` objectives (if available)
     - Determine potential conflicts with established patterns or principles

2. **Cross-Reference** (if applicable):
   - `roadmap/current_focus.md`
   - `roadmap/tech_debt_and_infra.md`
   - Any existing PRDs in `specs/`

---

## Phase 2: The Product Interview

Actively shape the feature. Don't just take orders—ask the questions that matter.

1. **Formulate 3-5 High-Value Questions**:
   - **Focus on**: User Experience, Business Logic, Edge Cases, Success Criteria
   - **Avoid**: Implementation details (no "which library?" or "what component?")
   - **Pro-tip**: Offer **Multiple Choice** options when possible (e.g., "A: Simple approach (Fast to market)", "B: Comprehensive approach (More robust)")

2. **Example Question Types**:
   - "Who is the primary user for this feature?"
   - "What happens if [edge case]?"
   - "Should this data persist across sessions?"
   - "What does success look like? How would you measure it?"
   - "What are we deliberately NOT solving in v1?"

3. **Wait for Answers**: Do not proceed until the user responds.

---

## Phase 3: Generate the PRD

Create a file at `specs/prd-[feature-name].md` using the template below.

### PRD Template

```markdown
# PRD: [Feature Name]

## 1. Objective
- **Goal**: One sentence summary of what we're building.
- **Motivation**: Why are we doing this? What problem does it solve?
- **Success Metrics**: How do we know it's working?

## 2. User Stories
- As a [User Role], I want to [Action], so that [Benefit].
- ...

## 3. User Experience
- **Entry Point**: How does the user discover/access this feature?
- **Happy Path**: Step-by-step flow (non-technical, user perspective).
- **Error States**: What happens when things go wrong? What does the user see?
- **Edge Cases**: Unusual but valid scenarios to handle.

## 4. Business Rules & Constraints
- Rule 1: (e.g., "Cannot have negative values")
- Rule 2: (e.g., "Must validate against X")
- Constraint: (e.g., "Privacy-first: no external API calls")

## 5. Data Requirements (Conceptual)
- What information is captured?
- What information is displayed?
- What relationships exist between data elements?
> Note: This is NOT a database schema—just the conceptual data model.

## 6. Decisions & Trade-offs
| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| ... | A, B, C | B | Because... |

## 7. Out of Scope (v1)
- What are we deliberately NOT doing?
- What might come in a future version?

## 8. Open Questions
- Any unresolved items that need further discussion?
```

---

## Phase 4: Review & Approval

1. Present the PRD to the user
2. Ask: **"Does this PRD capture your vision? Reply APPROVED to proceed to implementation planning."**
3. If **APPROVED**: Direct the user to run `/feature_blueprint` for technical implementation planning
4. If **NOT APPROVED**: Iterate on the PRD based on feedback

---

## Next Step After Approval

Once the PRD is approved, proceed to:
> **`/feature_blueprint`** — Generates the technical implementation plan based on this PRD.
