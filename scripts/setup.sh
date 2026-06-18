#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")/.."

echo "Installing dependencies..."
npm ci

echo "Configuring git hooks (Husky)..."
npm run prepare

echo "✓ Setup complete"
echo ""
echo "Next steps:"
echo "  npm run dev"
echo "  npm run validate"
