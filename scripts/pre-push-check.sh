#!/usr/bin/env bash

set -euo pipefail

branch_name="$(git symbolic-ref --quiet --short HEAD || true)"

if [[ -n "$branch_name" ]]; then
	allowed_branch_regex='^(develop|master|(feature|fix|chore|refactor|test)/[a-z0-9]+([._-][a-z0-9]+)*)$'

	if ! [[ "$branch_name" =~ $allowed_branch_regex ]]; then
		echo ""
		echo "Invalid branch name '$branch_name'."
		echo "Allowed: develop, master, feature/<slug>, fix/<slug>, chore/<slug>, refactor/<slug>, test/<slug>"
		echo ""
		exit 1
	fi
fi

if git show-ref --verify --quiet refs/remotes/origin/develop; then
	changed_files="$(git diff --name-only origin/develop...HEAD 2>/dev/null || true)"
	range_messages="$(git log --format='%s' origin/develop..HEAD 2>/dev/null || true)"

	if [[ -n "$range_messages" ]] &&
		echo "$range_messages" | grep -qE '^(feat|fix|chore|refactor|docs|perf)(\([^)]+\))?: '; then
		if ! echo "$changed_files" | grep -qx 'CHANGELOG.md'; then
			echo ""
			echo "CHANGELOG.md must be updated in this branch for release-note commit types."
			echo "Re-sync with origin/develop if needed, then add a changelog entry before push."
			echo ""
			exit 1
		fi
	fi
fi

echo "✓ Pre-push checks passed"
