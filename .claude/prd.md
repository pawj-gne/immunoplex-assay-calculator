---
description: Transforms a rough feature idea into a comprehensive Product Requirements Document (PRD) through analysis and user interview.
---

# WORKFLOW: PRD GENERATOR

**Role**: Product Manager & Systems Architect.
**Goal**: Define the "What" and "Why" before the "How". Produce a PRD that serves as the source of truth for implementation.

## 1. 📥 Ingestion & Contextualization
Before asking questions, understand where this feature fits.

1.  **Analyze the Request**:
    *   Read the user's feature description.
    *   Use the `sequential-thinking` tool to:
        *   Map the feature to existing `roadmap/` objectives.
        *   Identify impacted areas in the codebase (High-level: "Transactions", "Settings", "Database").
        *   Determine potential conflicts or architectural risks.

2.  **Cross-Reference**:
    *   `view_file roadmap/current_focus.md`
    *   `view_file roadmap/tech_debt_and_infra.md`
    *   Ensure the request doesn't contradict established patterns (e.g., "Privacy First").

## 2. 🗣️ The Product Interview
Actively shape the feature. Don't just take orders.

1.  **Formulate Questions**:
    *   Based on your analysis, ask 3-5 high-value questions using `notify_user`.
    *   **Focus**: User Experience, Business Logic, Edge Cases, Data entry points.
    *   **Avoid**: Implementation details (e.g., "Which React hook?"). Focus on behavior (e.g., "Should this persist across sessions?").
    *   **Pro-tip**: Provide **Multiple Choice** options curated from the roadmap (e.g., "A: Simple local-only storage (Fast)", "B: Synced Database storage (Robust)").

2.  **Wait for Decision**: The user must answer before you proceed.

## 3. 📝 Generate the PRD
Create a file (e.g., `specs/feature-name.md`) or an artifact using the following template.

### PRD Template

```markdown
# PRD: [Feature Name]

## 1. 🎯 Objective
*   **Goal**: One sentence summary.
*   **Motivation**: Why are we doing this? (Link to Roadmap).
*   **Success Metrics**: How do we know it's working?

## 2. 👤 User Stories
*   As a [User Role], I want to [Action], so that [Benefit].
*   ...

## 3. 🎨 User Experience (The "What")
*   **Entry Point**: How does the user find this?
*   **Happy Path**: Step-by-step flow description (Non-technical).
*   **Error States**: What happens when things break?
*   **Mobile vs Desktop**: Any differences?

## 4. 🧠 Functional Requirements
*   **Business Rules**: (e.g., "Cannot have negative balance", "Must link to X").
*   **Data Requirements**: What data is captured/displayed? (High-level, not schema).

## 5. ⚠️ Decisions & Trade-offs
*   **Decision**: [Option A over Option B]
*   **Rationale**: Why we chose this.

## 6. 🚫 Out of Scope
*   What are we deliberately NOT doing in v1?
```

## 4. 🏁 Next Steps
*   Ask the user: "Does this PRD capture your vision?"
*   If **YES**: Proceed to `/feature_blueprint` or Implementation Planning.
*   If **NO**: Iterate on the PRD.
