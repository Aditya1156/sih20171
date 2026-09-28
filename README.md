# VeilAgent

Privacy-first browser agent for SIH 2026 (PS SIH26171, Team MeltDown SIH26_053).

**Nothing sensitive leaves the device, and we can prove it.**

VeilAgent is a Chrome MV3 extension that perceives web pages locally, detects and redacts sensitive content before any network call, and lets a server-side LLM plan actions over sanitised context only. Real values are substituted locally — the server never sees them.

## Architecture

```
Page → Perceive → Detect (4 layers) → Redact → Sanitised Context → Backend LLM → Action → Execute locally
                                         ↓
                                    Vault (memory-only)
                                    Outbound Guard
```

### Privacy Pipeline

1. **Perceive** — Extract DOM elements + screenshot from the active tab
2. **Detect** — 4-layer detection: DOM rules, regex+validators, heuristic NER, vision heuristics
3. **Redact** — Replace PII with typed placeholders ([EMAIL_1], [PHONE_1]), mask screenshot regions
4. **Vault** — Store placeholder→real value mapping in memory-only storage (chrome.storage.session)
5. **Guard** — Scan every outbound request against vault values and PII patterns; block on match
6. **Reason** — Backend LLM receives only sanitised context, returns structured actions
7. **Act** — Execute actions locally; substitute real values from vault client-side

### Indian PII Support

Aadhaar (with Verhoeff validation), PAN, IFSC, UPI, +91 phone numbers — all with format-specific validators.

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11+
- Chrome 116+

### Extension Setup

```bash
cd extension
npm install
npm run dev
```

Load the extension in Chrome:
1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" → select `extension/dist/`
4. The VeilAgent side panel appears in Chrome's side panel menu

### Backend Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
```

Create `.env` from the example:
```bash
cp ../.env.example .env
# Edit .env and set:
#   BACKEND_API_TOKEN=<your-secret-token>
#   GEMINI_API_KEY=<your-gemini-api-key>
#   LLM_PROVIDER=gemini
```

Run the server:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Run Tests

Extension (216 tests):
```bash
cd extension
npm run check    # typecheck + lint + test
```

Backend (57 tests):
```bash
cd backend
BACKEND_API_TOKEN=test-token .venv/bin/python -m pytest tests/ -v
```

## Project Structure

```
extension/
  src/
    shared/        # Schemas, types
    content/       # Content script (perceive + execute)
    background/    # Service worker (screenshot, tab management)
    detectors/     # L1-L4 detection pipeline
    redactor/      # Placeholder, screenshot mask, sanitise, outbound guard
    vault/         # Memory-only vault
    executor/      # Action executor, vault substitution, agent loop
    ui/            # React side panel (App, PrivacyInspector, ConfirmDialog)
  tests/           # 216 tests
backend/
  app/
    routes/        # FastAPI agent endpoint
    schemas/       # Pydantic models
    security/      # Auth, rate limiter, size limit, log sanitiser
    llm_adapters/  # Gemini adapter, output parser, system prompt
  tests/           # 57 tests
benchmark/
  pages/           # 17 synthetic test pages
  seed_data.json   # Fake PII for testing
docs/
  evaluation.md    # Real benchmark results
```

## Security

- LLM keys live only on the backend; the extension never contains them
- Raw screenshot and raw DOM text never leave the browser
- Password field values are never read, only field existence and metadata
- Vault is memory-only, cleared on browser restart, never transmitted
- Outbound guard scans every request; blocks on PII match
- Backend logs contain no page content (sanitised formatter)
- All page content treated as untrusted (prompt injection defense)

See [SECURITY.md](SECURITY.md) for the full threat model.

## Test Results

273 tests total (216 extension + 57 backend), all passing.

| Category | Recall |
|----------|--------|
| Email | 100% |
| Phone (+91) | 100% |
| Aadhaar | 100% |
| PAN | 100% |
| UPI | 100% |
| IFSC | 100% |
| Password | 100% |
| Card | ≥60% |
| Name | ≥60% |

Zero seeded PII leaks across all 17 benchmark pages.

See [docs/evaluation.md](docs/evaluation.md) for full results.

## Team

Team MeltDown (SIH26_053)
