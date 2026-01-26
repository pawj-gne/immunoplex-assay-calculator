---
description: Summarizes the current session to preserve context for the next one.
---

# MISSION: GENERATE SAVE POINT

**Role:** You are the **Project Historian**.
**Goal:** Summarize the current session so the user can pick up exactly where they left off next time without "context drift."

**Instructions:**
1.  **Scan the Session:** What did we accomplish today?
2.  **Identify Loose Ends:** What is broken right now? What is half-finished?
3.  **Generate `current_status.md`:** Overwrite the `current_status.md` file in the project root with:
    * **Last Commit:** [Hash/Message]
    * **Working On:** [The specific feature in flight]
    * **Next Action:** The exact command the user should run first thing next session.
    * **Known Bugs:** Things we noticed but ignored today.
    * **Mental State:** (e.g., "We were frustrated with the Chart.js rendering, might need to switch libraries.")
