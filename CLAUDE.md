# VeilAgent

Privacy-first browser agent with on-device visual perception.

## Quick reference

- **Extension**: `cd extension && npm run check` (typecheck + lint + test)
- **Backend**: `cd backend && .venv/bin/python -m pytest tests/ -v`
- **Build extension**: `cd extension && npm run build` (output in `extension/dist/`)
- **Start backend**: `cd backend && .venv/bin/uvicorn app.main:app --reload`

## Project structure

- `extension/` — Chrome MV3 extension (TypeScript, React, Vite, Tailwind)
- `backend/` — FastAPI reasoning server (Python 3.11+)
- `benchmark/` — Seeded synthetic pages and recall/leak tests
- `docs/` — Architecture, evaluation report, demo script

## Rules

- Never hardcode secrets. Use `.env` (gitignored) and `.env.example` for variable names.
- Password field values are never read — only field existence and metadata.
- Raw screenshot and DOM text never leave the browser.
- Every metric must come from a real test run, never invented.
