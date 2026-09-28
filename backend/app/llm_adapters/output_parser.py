from __future__ import annotations

import json
import re

from ..schemas.models import (
    Action,
    ClickAction,
    TypeAction,
    ScrollAction,
    SelectAction,
    WaitAction,
    DoneAction,
    FailAction,
    AgentResponse,
)

VALID_TYPES = {"click", "type", "scroll", "select", "wait", "done", "fail"}

DANGEROUS_PATTERNS = [
    re.compile(r"javascript:", re.IGNORECASE),
    re.compile(r"data:", re.IGNORECASE),
    re.compile(r"<script", re.IGNORECASE),
    re.compile(r"eval\s*\(", re.IGNORECASE),
    re.compile(r"document\.", re.IGNORECASE),
    re.compile(r"window\.", re.IGNORECASE),
]


def parse_llm_output(raw: str) -> AgentResponse:
    cleaned = _extract_json(raw)
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        return _fail_response(f"LLM output is not valid JSON: {raw[:200]}")

    if not isinstance(data, dict):
        return _fail_response("LLM output is not a JSON object")

    action_type = data.get("type")
    if action_type not in VALID_TYPES:
        return _fail_response(f"Unknown action type: {action_type}")

    if _contains_dangerous_content(data):
        return _fail_response("LLM output contains potentially dangerous content")

    action = _build_action(data)
    if action is None:
        return _fail_response(f"Invalid fields for action type: {action_type}")

    reasoning = data.get("reasoning")
    return AgentResponse(action=action, thought=reasoning)


def _extract_json(raw: str) -> str:
    text = raw.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        start = 1
        end = len(lines)
        for i in range(1, len(lines)):
            if lines[i].strip() == "```":
                end = i
                break
        text = "\n".join(lines[start:end]).strip()
    return text


def _contains_dangerous_content(data: dict) -> bool:
    text = json.dumps(data)
    for pattern in DANGEROUS_PATTERNS:
        if pattern.search(text):
            return True
    return False


def _build_action(data: dict) -> Action | None:
    action_type = data["type"]
    reasoning = data.get("reasoning")
    try:
        if action_type == "click":
            return ClickAction(element_id=data["elementId"], reasoning=reasoning)
        elif action_type == "type":
            return TypeAction(
                element_id=data["elementId"],
                value=data["value"],
                reasoning=reasoning,
            )
        elif action_type == "scroll":
            return ScrollAction(
                direction=data["direction"],
                amount=data.get("amount"),
                reasoning=reasoning,
            )
        elif action_type == "select":
            return SelectAction(
                element_id=data["elementId"],
                value=data["value"],
                reasoning=reasoning,
            )
        elif action_type == "wait":
            return WaitAction(milliseconds=data["milliseconds"], reasoning=reasoning)
        elif action_type == "done":
            return DoneAction(summary=data["summary"], reasoning=reasoning)
        elif action_type == "fail":
            return FailAction(reason=data["reason"], reasoning=reasoning)
    except (KeyError, ValueError, TypeError):
        return None
    return None


def _fail_response(reason: str) -> AgentResponse:
    return AgentResponse(
        action=FailAction(reason=reason),
        thought="Output validation failed.",
    )
