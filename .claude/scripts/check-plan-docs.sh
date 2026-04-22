#!/usr/bin/env bash
# Stop hook: flag missing XX-YY-SUMMARY.md files for recent plan commits.

set -u

# Consume stdin (we don't use it) so the pipe doesn't SIGPIPE upstream.
cat >/dev/null 2>&1 || true

repo_root="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$repo_root" ]; then
  exit 0
fi
cd "$repo_root" || exit 0

# Pull last 60 days of commit subjects (wide window catches stale-repo backfill).
log="$(git log --since='60 days ago' --pretty=format:'%s' 2>/dev/null)"
if [ -z "$log" ]; then
  exit 0
fi

# Extract unique <phase>-<plan> pairs from subjects like `feat(03.3-05): ...`.
pairs="$(printf '%s\n' "$log" \
  | grep -Eo '(feat|fix|refactor)\(([0-9]+\.?[0-9]*)-([0-9]+)\)' \
  | sed -E 's/^(feat|fix|refactor)\(([0-9]+\.?[0-9]*)-([0-9]+)\)/\2-\3/' \
  | sort -u)"

if [ -z "$pairs" ]; then
  exit 0
fi

missing=""
while IFS= read -r pair; do
  [ -z "$pair" ] && continue
  found="$(find .planning/phases -type f -name "${pair}-SUMMARY.md" 2>/dev/null | head -n1)"
  if [ -z "$found" ]; then
    if [ -z "$missing" ]; then
      missing="$pair"
    else
      missing="$missing, $pair"
    fi
  fi
done <<EOF
$pairs
EOF

if [ -z "$missing" ]; then
  exit 0
fi

reason="Doc debt: missing SUMMARY files for plans: ${missing}. Run /gsd-close-plan or backfill."
printf '{"decision":"block","reason":%s}\n' "$(printf '%s' "$reason" | jq -Rs .)"
exit 0
