# Release Protocol

Execute each phase sequentially. Phases 1-2 are fully automated — run without stopping. Phase 3 requires user input for version. Phase 4 is post-merge.

## Phase 1: Pre-Flight (Automated, No Stops)

1. **Clean up temp files**:
   ```bash
   find . -name "tmpclaude-*" -type f -delete 2>/dev/null
   find . -name "temp_*" -type f -delete 2>/dev/null
   ```

2. **Check for uncommitted changes**:
   ```bash
   git status --porcelain
   ```
   - If changes exist: review, delete any test/debug artifacts, then execute `/commit`
   - If clean: continue

3. **Ensure branch is pushed**:
   ```bash
   git push -u origin HEAD
   ```

## Phase 2: Build Verification (Automated, No Stops)

Run all checks sequentially. If ANY step fails, fix and re-run from the failed step.

1. **TypeScript type check**:
   ```bash
   npx tsc --noEmit
   ```

2. **Production build** (renderer + main):
   ```bash
   npm run build
   ```

3. **Windows exe build**:
   ```bash
   npm run build:win
   ```

4. **Verify exe was created**:
   ```bash
   ls -la dist/*.exe
   ```
   Report the exe filename and size.

If any step fails:
- Document the specific failure
- Fix the issue
- Re-run from the failed step
- Do NOT proceed to Phase 3 until all pass

## Phase 3: Version Bump + PR Creation

**STOP: Present version suggestion before proceeding.**

1. **Determine version bump**:
   - Read current version from `package.json`
   - Analyze commits since last release: `git log dev/v1-01..HEAD --oneline`
   - Suggest semver:
     - **MAJOR** (X.0.0): Breaking changes
     - **MINOR** (0.X.0): New features
     - **PATCH** (0.0.X): Bug fixes, minor improvements
   - Present suggestion with rationale and wait for user approval

2. **Bump version** (after approval):
   ```bash
   npm version <major|minor|patch> --no-git-tag-version
   ```

3. **Update footer version** in `src/renderer/src/App.tsx`:
   - Find the version string in the footer (e.g., `v0.2.0`) and update to new version

4. **Rebuild with new version** (so exe has correct version):
   ```bash
   npm run build && npm run build:win
   ```

5. **Commit version bump**:
   ```bash
   git add package.json package-lock.json src/renderer/src/App.tsx
   git commit -m "chore: bump version to vX.X.X"
   git push
   ```

6. **Create PR** to `dev/v1-01` (main branch):
   ```bash
   gh pr create --base dev/v1-01 --title "vX.X.X - <summary>" --body "$(cat <<'EOF'
   ## Summary
   - <bullet points of major changes>

   ## Version
   vX.X.X — <rationale>

   ## Verification
   - [x] TypeScript type check passes
   - [x] Production build succeeds
   - [x] Windows exe built successfully (<size>)

   ## Test Plan
   - [ ] Install exe on production PC
   - [ ] Verify new features work
   - [ ] Verify existing features unbroken

   🤖 Generated with [Claude Code](https://claude.com/claude-code)
   EOF
   )"
   ```

7. Return the PR URL

## Phase 4: Post-Merge Cleanup

After the PR is merged:

### Step 1: Update local base branch
```bash
git checkout dev/v1-01
git pull origin dev/v1-01
```

### Step 2: Delete merged dev branch and start next
```bash
# Delete the old branch
git branch -D dev/v1-03

# Create next branch
git checkout -b dev/v1-04  # Increment!
```

### Step 3: Tag the release
```bash
git tag -a vX.X.X -m "Release vX.X.X"
git push origin vX.X.X
```

### Step 4: Deploy to production PC
- The exe is in `dist/` — copy to network folder or production PC
- Install by running the setup exe (NSIS installer handles upgrades in-place)

**STOP: Confirm cleanup and deployment are complete**
