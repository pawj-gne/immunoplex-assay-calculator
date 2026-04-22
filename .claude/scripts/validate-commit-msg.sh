#!/usr/bin/env bash
# PreToolUse hook: validate `git commit` messages match Conventional Commits.
# Reads Claude Code hook JSON from stdin. Non-commit bash commands are ignored.

set -u

# Read entire stdin payload.
payload="$(cat)"

# Extract the bash command string. If jq fails or field missing, exit 0 (don't block).
command="$(printf '%s' "$payload" | jq -r '.tool_input.command // empty' 2>/dev/null)"
if [ -z "$command" ]; then
  exit 0
fi

# Only act on `git commit ...`. Ignore `git log`, `git commit --help`, etc.
# Match `git commit` followed by space or end, but skip if `--help` / `-h` is present.
case "$command" in
  *"git commit --help"*|*"git commit -h"*)
    exit 0
    ;;
esac

# Require the command to actually start a `git commit` invocation.
if ! printf '%s' "$command" | grep -Eq '(^|[;&|[:space:]])git[[:space:]]+commit([[:space:]]|$)'; then
  exit 0
fi

# Extract the commit message. Strategy:
# 1. Heredoc form: look for `<<'EOF'` or `<<EOF` ... `EOF` block and take first non-empty line.
# 2. `-m '...'` or `-m "..."` form: grab first argument after -m.
msg=""

# Heredoc extraction (handles $(cat <<'EOF' ... EOF) pattern used by Claude Code commit protocol).
if printf '%s' "$command" | grep -q "<<'EOF'\|<<EOF\|<<-'EOF'\|<<-EOF"; then
  # Pull everything between the first EOF marker after `<<` and the closing EOF.
  msg="$(printf '%s' "$command" | awk '
    BEGIN { in_heredoc=0; found="" }
    {
      if (in_heredoc == 0 && match($0, /<<-?'\''?EOF'\''?/)) {
        in_heredoc=1
        rest=substr($0, RSTART+RLENGTH)
        # Split by literal EOF to find terminator on same line.
        n=split(rest, parts, /EOF/)
        if (n > 1) {
          found=parts[1]
          in_heredoc=0
          print found
          exit
        } else {
          print rest
        }
        next
      }
      if (in_heredoc == 1) {
        if (match($0, /^[[:space:]]*EOF/)) { in_heredoc=0; exit }
        print
      }
    }
  ')"
  # Take first non-empty trimmed line.
  msg="$(printf '%s' "$msg" | awk 'NF { sub(/^[[:space:]]+/, ""); print; exit }')"
fi

# Fallback: -m '...' or -m "..."
if [ -z "$msg" ]; then
  # Double-quoted form.
  msg="$(printf '%s' "$command" | sed -nE 's/.*-m[[:space:]]+"([^"]*)".*/\1/p' | head -n1)"
fi
if [ -z "$msg" ]; then
  # Single-quoted form.
  msg="$(printf '%s' "$command" | sed -nE "s/.*-m[[:space:]]+'([^']*)'.*/\1/p" | head -n1)"
fi

# First line only.
first_line="$(printf '%s' "$msg" | awk 'NR==1 { print; exit }')"

# If we couldn't find a message at all, don't block (might be `git commit` with editor).
if [ -z "$first_line" ]; then
  exit 0
fi

# Conventional Commits regex.
if printf '%s' "$first_line" | grep -Eq '^(feat|fix|refactor|docs|chore|style|test|perf|build|ci|revert)(\([^)]+\))?: .+'; then
  exit 0
fi

# Block with structured JSON.
reason="Commit message does not match Conventional Commits format. First line was: '${first_line}'. Expected: type(scope): subject  where type is one of feat|fix|refactor|docs|chore|style|test|perf|build|ci|revert."
printf '{"decision":"block","reason":%s}\n' "$(printf '%s' "$reason" | jq -Rs .)"
exit 0
