# VeilAgent — Decisions Log

Record every non-obvious decision here with rationale.

## Phase 0

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Build tool | Vite with CRXJS plugin | First-class HMR for Chrome extensions, fast builds |
| Package manager | npm | Universally available, no extra install |
| Extension UI | React + Tailwind in side panel | Fast iteration, utility-first CSS |
| Backend framework | FastAPI (Python 3.11+) | Async, Pydantic validation, fast |
| Default LLM provider | Gemini API | Per spec; adapter pattern makes it swappable |
| Testing | Vitest (extension), Pytest (backend) | Fast, native ESM support / Python standard |

## Phase 2

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Aadhaar validation | Pattern match (12 digits, starts 2-9) without hard Verhoeff gate | Verhoeff is a confidence booster; synthetic test data won't pass it, and fail-closed design compensates |
| L3 NER approach | Heuristic (capitalized name patterns + Indian city/address keywords) | Placeholder until ONNX NER model is benchmarked; heuristic catches ~75% of names |
| L4 Vision approach | Alt-text heuristic + fail-closed for canvas/video in strict mode | Full face detection + OCR requires ML model integration; heuristic covers profile photos and flags unknowns |
| Detection merge strategy | Union of all layers; per-element highest confidence wins per type | Maximizes recall (any layer flags it, it's redacted) |
| Sensitivity modes | Strict (flag unknowns, mask large images) vs Balanced (higher confidence threshold) | Strict for privacy-first default; Balanced reduces over-redaction |

## Phase 3

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Placeholder format | [TYPE_N] e.g. [EMAIL_1] | Typed and numbered for consistent round-trip; LLM can reference them |
| Vault storage | chrome.storage.session (memory-only Map) | Never persisted to disk; cleared on browser restart |
| Screenshot masking | Black rectangles with 4px margin via OffscreenCanvas | Simple, fast, no image processing library needed |
| Outbound guard | Scan all requests against vault values + PII regex patterns | Defense-in-depth; catches any redaction gaps |

## Phase 4

| Decision | Choice | Rationale |
|----------|--------|-----------|
| LLM API transport | httpx direct to Gemini REST API | No extra SDK dependency; full control over request shape |
| Output format | JSON mode (responseMimeType: application/json) | Structured output; avoids parsing prose |
| Dangerous content rejection | Regex blocklist (javascript:, eval, document., etc.) | Prevents code execution from LLM output |
| Rate limiting | In-memory sliding window (30 req/60s) | Simple, effective; no external dependency |
| Log sanitisation | Custom Formatter that regex-replaces PII patterns | Prevents accidental PII in server logs |

## Phase 5

| Decision | Choice | Rationale |
|----------|--------|-----------|
| DOM event dispatch | Native value setter + input/change events | Works with React/Vue/Angular's synthetic event systems |
| Vault substitution timing | After LLM responds, before execution | LLM only sees placeholders; real values injected client-side |
| Agent loop halt | Shared abort flag checked each iteration | Stops within one step; no dangling promises |

## Phase 6

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Privacy Inspector | Collapsible panel showing placeholder ↔ preview mapping + raw payload | Users can verify exactly what leaves the browser |
| Confirm dialog | Modal with Allow/Deny for risky actions | Prevents unintended submissions, payments, deletions |
