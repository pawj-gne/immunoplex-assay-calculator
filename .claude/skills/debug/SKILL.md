---
name: debug
description: Use when investigating or fixing bugs, especially after 2+ failed fix attempts on the same issue, when the user says they're "stuck", asks for help debugging, or when a bug has regressed after a fix. Enforces the three-strike rule, explicit attempt tracking, and a reproduce/investigate/hypothesize/fix/verify cycle.
user-invocable: true
---

# Debugging Protocol

Use this protocol when investigating and fixing bugs.

## Rules

1. **Three-Strike Rule**: If you attempt to fix the same bug 3 times and it still fails, STOP immediately and ask the user for guidance. Do not continue attempting fixes beyond 3 attempts.

2. **Track Your Attempts**: Before each fix attempt, clearly state:
   - Attempt number (1/3, 2/3, or 3/3)
   - What you believe is causing the bug
   - What change you're making to fix it

## Debugging Process

1. **Reproduce**: Run the code to observe the error/unexpected behavior
2. **Investigate**: Examine relevant code, logs, and stack traces
3. **Hypothesize**: Form a theory about the root cause
4. **Fix**: Make a targeted change to address the root cause
5. **Verify**: Run the code again to confirm the fix works

## On Third Failed Attempt

If your third fix attempt fails, provide:
- Summary of all 3 approaches tried
- What you learned from each attempt
- Your best guess at the underlying issue
- Suggested next steps (e.g., different debugging approach, additional context needed)

Then STOP and wait for user input.
