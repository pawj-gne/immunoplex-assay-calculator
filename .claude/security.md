---
description: A comprehensive security and reliability audit for Finance Flow.
---

# MISSION: SECURITY VULNERABILITY & DATA LOSS AUDIT

**Role:** You are the **Head of Information Security (CISO)** and **Staff Reliability Engineer**.
**Goal:** Audit the "Finance Flow" codebase for security vulnerabilities, data loss risks, and architectural flaws.

**Context:** Next.js (App Router), Supabase (Postgres), Drizzle ORM, Server Actions.
**Tolerance:** Zero tolerance for data loss or exposed secrets.

**Instructions:**
Do not fix issues yet. Your job is **Red Teaming**: Find the holes. Execute these phases:

### PHASE 1: The "Hardcoded" Hunt (Secrets Management)
1.  **Scan for Secrets:**
    *   Inspect `next.config.ts`, `drizzle.config.ts`, and `lib/db/index.ts`.
    *   **Goal:** Ensure NO hardcoded connection strings or API keys exist.
    *   **Env Check:** Verify `process.env.DATABASE_URL` is checked for existence before use (e.g., throwing an error if missing, rather than crashing later).
2.  **Git Safety:**
    *   Check `.gitignore`. Are `.env`, `.env.local`, `.env.production`, and `.DS_Store` explicitly excluded?
    *   Check `scripts/` folder for any "helper" scripts that might have hardcoded credentials.

### PHASE 2: Disaster & Data Loss Prevention (Crucial)
1.  **Transaction Atomicity Check (The "Partial Write" Risk):**
    *   **Target:** `app/actions/transactions.ts` (specifically `uploadTransactionsInternal`).
    *   **Audit:** This function performs multiple inserts/updates (institutions, accounts, transactions). Does it run inside a single `db.transaction(...)` block?
    *   **Risk:** If the server crashes halfway through an upload, do we end up with "half-imported" data?
2.  **Destructive Write Analysis:**
    *   Identify all `db.delete()` or `db.update()` calls.
    *   **The "Backup" Check:** Is there a mechanism to "undo" or are these changes permanent immediately?
    *   **Race Conditions:** Check `getAccountId` in `transactions.ts`. If two imports run in parallel, can they create duplicate "Chase" accounts simultaneously?

### PHASE 3: Input Validation & Injection
1.  **CSV "Poison Pill" Check:**
    *   **Target:** `app/actions/transactions.ts`.
    *   **Audit:** `Papa.parse` is used. Is the output validated against a strict Schema (Zod) *before* processing?
    *   **Risk:** What happens if `Amount` is "NaN" or "1,000" (with comma)? Does `parseFloat` handle it or result in `NaN` in the DB?
2.  **Sanitization:**
    *   **Target:** `components/finance/TransactionTable.tsx` and other UI components.
    *   **Audit:** Ensure `dangerouslySetInnerHTML` is NOT used.
    *   **XSS:** Verify that user user-provided content (e.g., `cleanMerchantName`) is escaped by React default behavior.

### PHASE 4: The "Silent Fail" Scan
1.  **Error Swallowing in Actions:**
    *   **Target:** `app/actions/*.ts`.
    *   **Audit:** specific look at `try { ... } catch (e) { console.log(e) }` blocks.
    *   **Verdict:** This is unacceptable. Errors must either be thrown to trigger the boundary OR returned as `{ success: false, error: ... }` to be displayed by Sonner.
    *   **Specific Check:** Look at the `catch` block in `uploadTransactionsInternal` inside the batch loop. Does it swallow errors and proceed?

### PHASE 5: Architecture & Live Protocol
1.  **Port Discipline:**
    *   Verify `package.json` scripts. Ensure `dev` targets port 3001 and `start:live` targets 3000.
    *   **Live DB Protection:** Check `drizzle.live.config.ts`. Does it prevent accidental pushes?
    *   **Migration Safety:** Review `scripts/db_manager.ts`. Does it require manual confirmation before running against Live?

### REPORT GENERATION
Generate a **Security Impact Report** (`security_audit_report.md`) with these sections:

*   🚨 **DEFCON 1 (Immediate Data Loss/Security Risk):** Missing transactions, exposed keys, race conditions in account creation, silent error swallowing.
*   🟠 **HIGH (Stability Risk):** Weak input validation (no Zod for CSV), lack of backup before destructive actions.
*   🔵 **MEDIUM (Best Practice):** Hardcoded "magic strings", minimal logging.
*   🛡️ **REMEDIATION PLAN:** For every DEFCON 1 item, write a specific, step-by-step fix instruction.

**Await my command to execute the Remediation Plan.**
