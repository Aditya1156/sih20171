from __future__ import annotations

import asyncio
import json
import logging
import os

import httpx

from .base import LLMAdapter
from .prompts import SYSTEM_PROMPT, build_user_message
from .output_parser import parse_llm_output
from ..schemas.models import AgentRequest, AgentResponse, FailAction

logger = logging.getLogger("veilagent.llm")

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
DEFAULT_MODEL = "gemini-flash-latest"


class GeminiAdapter(LLMAdapter):
    def __init__(self) -> None:
        self._api_key = os.environ.get("GEMINI_API_KEY", "")
        self._model = os.environ.get("GEMINI_MODEL", DEFAULT_MODEL)

    async def get_action(self, request: AgentRequest) -> AgentResponse:
        if not self._api_key:
            return AgentResponse(
                action=FailAction(reason="GEMINI_API_KEY not configured"),
                thought="Missing API key.",
            )

        context_json = request.context.model_dump_json(exclude={"screenshot_base64"})
        history_json = json.dumps(
            [a.model_dump() for a in request.history] if request.history else []
        )

        user_msg = build_user_message(
            task=request.task,
            context_json=context_json,
            history_json=history_json,
            step=request.step,
            max_steps=request.max_steps,
        )

        payload = {
            "contents": [
                {"role": "user", "parts": [{"text": SYSTEM_PROMPT + "\n\n" + user_msg}]},
            ],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 2048,
            },
        }

        url = GEMINI_API_URL.format(model=self._model)

        max_retries = 3
        resp = None
        for attempt in range(max_retries):
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.post(
                        url,
                        headers={"X-goog-api-key": self._api_key},
                        json=payload,
                    )
                    resp.raise_for_status()
                    break
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 503 and attempt < max_retries - 1:
                    logger.warning("Gemini 503, retrying in %ds...", 2 ** attempt)
                    await asyncio.sleep(2 ** attempt)
                    continue
                logger.error("Gemini API error: status=%d", e.response.status_code)
                return AgentResponse(
                    action=FailAction(reason=f"LLM API error: {e.response.status_code}"),
                    thought="Gemini API call failed.",
                )
            except httpx.RequestError as e:
                logger.error("Gemini request error: %s", type(e).__name__)
                return AgentResponse(
                    action=FailAction(reason="LLM API request failed"),
                    thought="Network error calling Gemini.",
                )

        if resp is None:
            return AgentResponse(
                action=FailAction(reason="LLM API failed after retries"),
                thought="All retry attempts exhausted.",
            )

        body = resp.json()
        try:
            raw_text = body["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError):
            logger.error("Unexpected Gemini response structure")
            return AgentResponse(
                action=FailAction(reason="Unexpected LLM response format"),
                thought="Could not extract text from Gemini response.",
            )

        logger.info(
            "LLM response received: step=%d, length=%d",
            request.step,
            len(raw_text),
        )

        return parse_llm_output(raw_text)
