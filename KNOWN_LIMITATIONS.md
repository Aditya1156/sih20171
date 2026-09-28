# VeilAgent — Known Limitations

This document tracks known failure cases and limitations honestly.

*Updated after Phase 7 benchmark runs.*

## Detection Limitations

### Cross-origin iframes
- **Impact**: Cannot access DOM content of cross-origin iframes
- **Mitigation**: Screenshot masking covers visible regions; fail-closed flags unknown frames in strict mode
- **Status**: Browser security constraint; no workaround without proxy

### Multilingual PII
- **Impact**: Hindi, Kannada, Tamil, and other non-Latin script PII detection is not supported
- **Mitigation**: English and standard Indian PII formats (Aadhaar, PAN, IFSC, UPI) are fully covered
- **Status**: Requires ML-based NER model for Indic languages

### Name detection
- **Impact**: Heuristic-based (capitalized word patterns); recall ~60% on seed data
- **Mitigation**: Catches common "Firstname Lastname" patterns; misses single-word names
- **Status**: L3 NER integration point exists; plug in ONNX model for higher recall

### Canvas / WebGL content
- **Impact**: Cannot extract text or detect faces in canvas-rendered content
- **Mitigation**: Strict mode flags canvas elements as PII_IMAGE; screenshot masking covers bounding box
- **Status**: Requires OCR + face detection ML model integration

### Card number formats
- **Impact**: Non-standard card groupings (e.g., Amex 4-6-5) may not match all formatting variations
- **Mitigation**: Luhn validation catches continuous digit strings; common 4-4-4-4 format fully detected
- **Status**: Recall ≥60% on seed data; could improve with more format patterns

### Obfuscated PII
- **Impact**: "user [at] domain [dot] com" format detected at lower confidence (0.80)
- **Mitigation**: L2 detector includes obfuscated email pattern
- **Status**: More obfuscation patterns could be added

## Architecture Limitations

### Browser support
- Chrome MV3 only (Chrome 116+)
- No Firefox support (different extension API)
- Safari not supported

### LLM dependency
- Backend requires a valid GEMINI_API_KEY for the agent to reason
- Without API key, agent returns "GEMINI_API_KEY not configured" fail action
- Agent quality depends on LLM model capabilities

### Vault scope
- Vault is per-session (chrome.storage.session), cleared on browser restart
- Vault is not shared across tabs
- Maximum vault size is limited by chrome.storage.session quota (~10MB)

### Rate limiting
- In-memory rate limiter (30 requests/60s) — resets on server restart
- No persistent rate limiting across server restarts
- Single-key rate limiting (by IP, not by token)

## False Positive Cases

### Bank account numbers
- 14+ digit bank account numbers may be flagged by the outbound guard's card pattern
- Aadhaar pattern (12 digits starting 2-9) can match account number substrings
- Mitigation: word-boundary checks in detection; guard is a secondary defense
