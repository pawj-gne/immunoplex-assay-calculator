---
id: SEED-001
status: dormant
planted: 2026-06-22
planted_during: v1.0 Smoke 3 Release — Phase 16 (Windows UAT & Release)
trigger_when: After v1.0.0 ships to the lab PC and operators have used it for ~1–2 weeks of real assay setup work
scope: Large
---

# SEED-001: Workflow UI overhaul — re-sequence the app around the bench workflow

## Why This Matters

Today's screen order was driven by **data-model dependencies** (platform → species → panel → analytes → samples → plate), not by **how an operator actually sets up a plate at the bench**. Operators have to mentally translate between the order they think in and the order the app forces, which adds cognitive load and slows first-time use.

The overhaul re-sequences screens, navigation, and inputs around the real bench workflow so the app feels like an assistant walking alongside the operator instead of a form to be filled in dependency order.

This is a **product-shape change**, not a coat of paint — affects routing, screen composition, navigation primitives, and likely the selection store. It is NOT a Phase 3.3-style single-screen redesign.

## When to Surface

**Trigger:** After v1.0.0 ships to the lab PC and operators have used it for ~1–2 weeks of real assay setup work.

This seed should be presented during `/gsd-new-milestone` when the milestone scope matches any of these conditions:
- The next milestone is being framed around **operator feedback** from real v1.0 use
- The next milestone touches **navigation, screen flow, page composition, or selection store ordering**
- The next milestone is the **first v1.1+ feature milestone** after the v1.0 lab rollout settles
- The conversation mentions any of: "workflow", "friction", "screen order", "wizard", "ux", "operator usability", "training time"

## Scope Estimate

**Large** — A full milestone of its own (likely v1.2 or v2.0 — sequencing TBD relative to Phase 6 Network Layer, Phase 7 Audit Trail, and the Master-Panel v2.0 arc).

Anticipated phase shape (NOT a commitment — to be derived at milestone-planning time from actual lab feedback):
- Phase A: Bench-workflow audit — observe / interview lab use of v1.0, produce a documented "real workflow order"
- Phase B: Information architecture redesign — route map, screen inventory, selection-store reshape
- Phase C: Screen-by-screen rebuild aligned to the new order, applying the Phase 3.3 visual-grid pattern consistently
- Phase D: Navigation primitives (back/forward through the workflow, save/resume mid-flight, finalize → run-document handoff)
- Phase E: UAT against the same lab PC + operators that surfaced the friction

## Breadcrumbs

Related code, decisions, and context in the current codebase at plant time:

- `.planning/phases/03.3-analyte-selection-redesign/` — Phase 3.3 was a single-screen visual-grid redesign; informs the **visual** target but did NOT touch workflow order. The rest of the app has not caught up.
- `src/renderer/` — current route structure / screen composition (platform → species → panel → analytes → samples → plate flow)
- `src/renderer/stores/selectionStore.*` — selection ordering is currently encoded here; a workflow re-sequence almost certainly reshapes this store
- `.planning/PROJECT.md` §Current Milestone — locked to v1.0 Smoke 3 Release as of plant time; this seed deliberately defers until that ships
- `.planning/ROADMAP.md` — Phase 6 (Network Layer / v1.1), Phase 7 (Audit Trail / v1.2), and Phases 8–11 (v2.0 Master Panel arc) are the existing post-v1.0 commitments — this seed competes with them for milestone slot ordering
- `.planning/phases/16-windows-uat-release/16-SMOKE-TEST-GUIDE.md` — the Smoke 3 UAT script is itself an implicit record of the current workflow; comparing it to operator notes post-UAT will produce the "real workflow order" input for Phase A above

## Notes

- Planted while Phase 16 Wave 1 was in progress; the user initially invoked `/gsd-new-milestone "workflow UI overhaul"` but v1.0 is not yet shipped — seeding rather than committing the new milestone preserves the idea without disturbing the active release work.
- The "Match real lab workflow order" framing was chosen deliberately over "modernize visual design" — visual modernization can ride along but is not the driver.
- When this seed surfaces, re-evaluate whether it should be **v1.2 (slot in before Audit Trail)** or **v2.0+ (slot in after Master Panel arc)** based on which user value is more pressing at that moment.
- Consider whether parts of this should land **incrementally** alongside other milestones (e.g. a navigation primitive built during the Network Layer milestone) vs being held back as a single coherent overhaul.
