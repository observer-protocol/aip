#!/usr/bin/env bash
# Refuse a schema publication that would carry anything but schema files.
#
# WHY THIS EXISTS
#
# v2.5's publication commit landed on a session branch carrying unrelated work, in a repo whose
# default branch is `master` rather than `main`. Nothing extra shipped, and only because the other
# commit happened to be upstream already. Had it not been, unrelated work would have deployed
# alongside an IMMUTABLE schema and no step in the process would have objected.
#
# Right outcome, wrong reason. Same shape as the frozen-evidence filter surviving on file
# extensions. So the third publication condition is a check rather than an intention: whoever runs
# the next mint will not have that session's context and will not know the default branch is
# unusual.
#
# Usage: publish-precheck.sh <website-repo> [<upstream-ref>]
set -euo pipefail
REPO="${1:?usage: publish-precheck.sh <website-repo> [upstream-ref]}"
UPSTREAM="${2:-}"

if [ -z "$UPSTREAM" ]; then
  # Resolve the DEFAULT branch rather than assuming it. Assuming `main` is what put the first
  # attempt on a session branch.
  UPSTREAM="$(git -C "$REPO" symbolic-ref --quiet --short refs/remotes/origin/HEAD || echo '')"
  [ -n "$UPSTREAM" ] || { echo "FAIL: cannot resolve origin/HEAD; pass the upstream ref explicitly"; exit 1; }
fi
echo "publishing against: $UPSTREAM"

CHANGED="$(git -C "$REPO" diff --name-only "$UPSTREAM" HEAD)"
[ -n "$CHANGED" ] || { echo "FAIL: nothing to publish"; exit 1; }

echo "files in this deploy:"
printf '  %s\n' $CHANGED

NON_SCHEMA="$(printf '%s\n' $CHANGED | grep -v '^schemas/.*\.json$' || true)"
if [ -n "$NON_SCHEMA" ]; then
  echo
  echo "REFUSED: a schema publication must carry schema files ONLY."
  echo "If something breaks, the cause should be one file rather than a website release."
  printf '  not a schema: %s\n' $NON_SCHEMA
  exit 1
fi

# A schema publication ADDS a URL. It never modifies one, because the bytes at a published URL are
# immutable and a modification here is the violation the whole policy exists to prevent.
MODIFIED="$(git -C "$REPO" diff --name-status "$UPSTREAM" HEAD | awk '$1 != "A" {print $2}')"
if [ -n "$MODIFIED" ]; then
  echo
  echo "REFUSED: this deploy MODIFIES or DELETES a published schema. Bytes at a published URL are immutable."
  printf '  %s\n' $MODIFIED
  exit 1
fi

echo
echo "OK: schemas only, additions only."
