# Commit Protocol

Standard workflow for branching, development, and committing changes. This focuses on the development loop: branching, coding, verifying, cleaning up, and committing. It does **not** cover merging or releasing.

## Conversation-Scoped Commits (Default Behavior)

By default, **only commit changes made during the current conversation**:
- Review the conversation history to identify which files YOU modified
- Cross-reference with `git diff` to find the specific changes from this session
- Changes from previous conversations or other sources should NOT be included in the initial commit

## Steps

### 1. Branch Setup

**Goal**: Ensure you are working on a development branch.

**Rule**: Never work directly on `main`.

**Naming Convention**: Use a "Running Number" development branch for the current major version (e.g., `dev/v1-01`, `dev/v1-02`).

**Logic**:
- Each "run" of work has a unique history that starts clean from `main`
- Reset the sequence on major version increments (v2.0 → `dev/v2-01`)

```bash
# 1. Check main is up to date
git checkout main
git pull origin main

# 2. Create the unique run branch
git checkout -b dev/v1-01  # Increment this number for each new run!
```

### 2. Clean Up Temp Files

Silent, no output needed:
```bash
# Remove Claude Code temp files
find . -name "tmpclaude-*" -type f -delete 2>/dev/null

# Remove other temp files
find . -name "temp_*" -type f -delete 2>/dev/null
```

### 3. Gather Context

Run in parallel:
- `git status` - see all changed/untracked files
- `git diff` - see unstaged changes
- `git diff --staged` - see staged changes
- `git log --oneline -5` - see recent commit style

### 4. Pre-Commit Cleanup

**Goal**: Keep the repository clean.
- Delete any temporary test files, scripts, or logs created during dev
- Remove unused imports or commented-out code blocks

### 5. Atomic Commits & Scope Verification

**Rule 1 - Relevancy**: Only commit changes implemented in the current chat/task.

**Rule 2 - Atomic Separation**: If you see modified files unrelated to your current task, do NOT include them in your commit.

**Rule 3 - Interactive Check**: After committing relevant changes, check `git status` again.
- If other changes remain: STOP and ask the user: *"I see other changed files ([files]). Do you want to commit these as well?"*

**Sensitive Files**: Do NOT stage `.env`, `config.ini`, credentials, or other sensitive files.

```bash
git status  # Check for unrelated files!
git add <relevant_files_only>
git commit -m "feat: implement requested change"

# Check for leftovers
git status
# If not clean, ASK USER before proceeding.
```

### 6. Push to Origin

Push your branch to the remote repository. Always push after committing (don't ask).

```bash
git push -u origin HEAD  # Sets upstream on first push
# Or: git push origin HEAD
```

### 7. Roadmap Sync

**Goal**: Keep `roadmap/current_focus.md` accurate.

**Logic**:
1. Read `roadmap/current_focus.md`
2. Compare against the files/features just committed
3. If any `[ ]` items are now complete, mark them `[x]`
4. If you update the file, commit it: `git commit -am "docs: update roadmap progress" && git push`

## Commit Message Format

```
<type>: <concise summary>

<optional body explaining why/context>
```

First line: 50 chars ideal, 72 max. Use imperative mood ("add feature" not "added feature").

## Types (Conventional Commits)

- `feat:` - new feature
- `fix:` - bug fix
- `refactor:` - code restructure without behavior change
- `docs:` - documentation only
- `chore:` - maintenance, dependencies, config
- `style:` - formatting, no code change
- `test:` - adding or updating tests

## Atomic Commits

1. Group related changes into logical, atomic commits
2. Each commit = ONE coherent change (feature, fix, or refactor)
3. If changes span multiple concerns, create separate commits for each
4. Write descriptive commit messages explaining the "why"

## Rules

- NEVER commit directly to main - always use a dev branch
- NEVER commit without reading the diff first
- NEVER use `--no-verify` or skip hooks
- NEVER amend commits that have been pushed
- ALWAYS push after committing (don't ask)
- Ask for clarification if the changes are ambiguous
- Default to conversation-scoped commits; ask before committing other changes
