# VeilAgent — Security Model

## Threat Model

### Leak Paths
| Path | Mitigation |
|------|-----------|
| Raw screenshot sent to server | Screenshot never leaves the browser; only redacted version used in sanitised context |
| DOM text containing PII sent to server | 4-layer detection + redaction replaces PII with typed placeholders before transmission |
| Password field values exfiltrated | Never-read rule: password field values are never read, only field existence and metadata |
| Vault contents transmitted | Vault is memory-only (`chrome.storage.session`), cleared on tab close, never included in network payloads |
| PII in outbound request headers/cookies | Outbound guard strips cookies, storage, headers, form values, and URL query params from context |
| PII leaked through backend logs | Backend logs only request IDs, timings, and status — no page content |

### Prompt Injection
| Threat | Mitigation |
|--------|-----------|
| Malicious page content hijacks agent | System prompt declares all page text untrusted; page content never overrides task rules |
| Crafted DOM text tricks LLM into unsafe actions | Strict JSON action schema; reject unknown actions, off-page targets, non-whitelisted fields |
| Server-returned code execution | No arbitrary code execution from server output; actions are schema-validated |

### Malicious Pages
| Threat | Mitigation |
|--------|-----------|
| Hidden fields containing PII | Detection scans all DOM elements including hidden/off-screen; fail-closed masking |
| Honeypot inputs | Container-level heuristics flag entire payment/personal sections |
| Obfuscated PII formats | Regex patterns handle spaced, dashed, and common obfuscation patterns |

### Compromised Backend
| Threat | Mitigation |
|--------|-----------|
| Backend requests unsafe actions | Action executor validates against strict schema; risky actions require user confirmation |
| Backend attempts to exfiltrate vault | Vault exists only in extension memory; backend has no access to it |
| Man-in-the-middle | HTTPS required in deployed environments |

## Extension Permissions (Minimal)
| Permission | Justification |
|-----------|--------------|
| `activeTab` | Access current tab DOM and capture screenshot |
| `sidePanel` | Show the VeilAgent UI |
| `storage` (session only) | Memory-only vault for placeholder-to-value mapping |
| `scripting` | Inject content script for DOM extraction and action execution |
| Host permission (active tab only) | Required for content script injection |

## Residual Risks
- PII in images/canvas may be missed if OCR fails (mitigated by fail-closed masking)
- Cross-origin iframes cannot be accessed via DOM (mitigated by screenshot-layer detection)
- Novel PII formats not covered by regex or NER (mitigated by user approval flow)
- LLM hallucination producing incorrect actions (mitigated by schema validation + confirmation dialogs)
