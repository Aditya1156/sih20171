from __future__ import annotations

import os

from .base import LLMAdapter
from .gemini import GeminiAdapter


def create_adapter() -> LLMAdapter:
    provider = os.environ.get("LLM_PROVIDER", "gemini").lower()
    if provider == "gemini":
        return GeminiAdapter()
    raise ValueError(f"Unknown LLM provider: {provider}. Supported: gemini")
