# Release Protocol

Execute each phase and confirm with the user before proceeding to the next.

## Phase 1: Commit Outstanding Changes

1. **Clean up temp files first** (silent, no output needed):
   ```bash
   # Remove Claude Code temp files
   find . -name "tmpclaude-*" -type f -delete 2>/dev/null
   ```

2. Run `git status` to check for uncommitted changes
3. **If NO uncommitted changes**: skip to Phase 2 immediately (no user confirmation needed)
4. **If uncommitted changes exist**:
   - Review and DELETE any test files, debug scripts, temporary code, or commented-out blocks
   - Execute `/commit` (it will detect the release-protocol context and skip branch confirmation prompts)
   - Confirm changes are committed before proceeding to Phase 2

---

## Phase 2: Automated Verification

<!-- Update this section once the tech stack and build process are defined -->

1. Run linting/type checks:
   ```bash
   # npm run lint
   # npm run typecheck
   ```

2. Run tests:
   ```bash
   # npm test
   ```

3. Build for production:
   ```bash
   # npm run build
   ```

If verification fails:
- Document the specific failure
- Do NOT proceed to PR creation
- Fix issues and re-run verification

**STOP: Confirm all checks passed before proceeding**

---

## Phase 3: PR Creation

1. Analyze the nature of changes and suggest next semver version:
   - **MAJOR** (X.0.0): Breaking changes, incompatible API/config changes
   - **MINOR** (0.X.0): New features, backwards-compatible additions
   - **PATCH** (0.0.X): Bug fixes, minor improvements, refactoring
2. Present version suggestion with rationale for user approval
3. Update version in the appropriate location (package.json, pyproject.toml, etc.)
4. Create a "Prepare for vX.X.X release" commit
5. Push branch to remote:
   ```bash
   git push -u origin <current-branch-name>
   ```
6. Create PR to main with:
   - **Title format: `vX.X.X - <summary of major changes>`**
     - Summarize the most significant changes
     - Prioritize major features/fixes over minor ones
   - Summary of all changes (reference commits)
   - Version bump with rationale
   - Test plan checklist
7. Return the PR URL

**STOP: Confirm version suggestion and PR details before creating**

---

## Phase 4: Post-Merge Cleanup

After the PR is merged:

### Step 1: Update local main
```bash
git checkout main
git pull origin main
```

### Step 2: Delete merged dev branch and start next sequence
```bash
# Delete the old run branch (main has the history now)
git branch -D dev/v1-01

# Start the next run
git checkout -b dev/v1-02  # Increment the run number!
```

### Step 3: Create release/tag (if applicable)
```bash
git tag -a vX.X.X -m "Release vX.X.X"
git push origin vX.X.X
```

### Step 4: Build and deploy (if applicable)
<!-- Update with project-specific build/deploy steps -->

**STOP: Confirm cleanup and release are complete**
