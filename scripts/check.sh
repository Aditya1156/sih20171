#!/usr/bin/env bash
set -euo pipefail

echo "=== Extension: typecheck ==="
cd extension
npm run typecheck

echo "=== Extension: lint ==="
npm run lint

echo "=== Extension: test ==="
npm run test

cd ..

echo "=== Backend: test ==="
cd backend
python -m pytest tests/ -v

echo "=== All checks passed ==="
