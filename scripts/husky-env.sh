#!/usr/bin/env bash

# Git hooks run with a minimal PATH (no nvm/fnm/homebrew shell init).
# Source this from Husky hooks before calling node/npx.

if command -v node >/dev/null 2>&1; then
	export PATH="$(dirname "$(command -v node)"):${PATH}"
	return 0 2>/dev/null || exit 0
fi

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
	# shellcheck disable=SC1091
	. "$NVM_DIR/nvm.sh"
	if [ -f .nvmrc ]; then
		nvm use --silent 2>/dev/null || nvm use 2>/dev/null || true
	fi
fi

if command -v fnm >/dev/null 2>&1; then
	eval "$(fnm env --shell bash 2>/dev/null)" || true
fi

export PATH="/opt/homebrew/bin:/usr/local/bin:${PATH}"

if ! command -v node >/dev/null 2>&1; then
	echo ""
	echo "husky: Node.js not found in PATH."
	echo "Install Node 22 (see .nvmrc), then run: nvm use && bash scripts/setup.sh"
	echo ""
	return 127 2>/dev/null || exit 127
fi

export PATH="$(dirname "$(command -v node)"):${PATH}"
