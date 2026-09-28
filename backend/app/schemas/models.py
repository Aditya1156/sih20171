from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class SensitiveType(str, Enum):
    PASSWORD = "PASSWORD"
    EMAIL = "EMAIL"
    PHONE = "PHONE"
    AADHAAR = "AADHAAR"
    PAN = "PAN"
    CARD = "CARD"
    UPI = "UPI"
    IFSC = "IFSC"
    NAME = "NAME"
    ADDRESS = "ADDRESS"
    FACE = "FACE"
    PII_IMAGE = "PII_IMAGE"
    UNKNOWN_SENSITIVE = "UNKNOWN_SENSITIVE"


class RedactedElement(BaseModel):
    id: str
    tag: str
    role: str | None = None
    type: str | None = None
    label: str | None = None
    placeholder: str | None = None
    text: str | None = None
    is_visible: bool = True


class Viewport(BaseModel):
    width: int
    height: int


class ScrollPosition(BaseModel):
    x: int
    y: int


class RedactionSummary(BaseModel):
    total_redacted: int
    by_type: dict[str, int] = Field(default_factory=dict)


class SanitisedContext(BaseModel):
    url: str
    title: str
    elements: list[RedactedElement]
    screenshot_base64: str | None = None
    viewport: Viewport
    scroll_position: ScrollPosition
    timestamp: float
    sensitivity_mode: Literal["strict", "balanced"]
    redaction_summary: RedactionSummary


class ClickAction(BaseModel):
    type: Literal["click"] = "click"
    element_id: str
    reasoning: str | None = None


class TypeAction(BaseModel):
    type: Literal["type"] = "type"
    element_id: str
    value: str
    reasoning: str | None = None


class ScrollAction(BaseModel):
    type: Literal["scroll"] = "scroll"
    direction: Literal["up", "down", "left", "right"]
    amount: int | None = None
    reasoning: str | None = None


class SelectAction(BaseModel):
    type: Literal["select"] = "select"
    element_id: str
    value: str
    reasoning: str | None = None


class WaitAction(BaseModel):
    type: Literal["wait"] = "wait"
    milliseconds: int = Field(gt=0, le=10000)
    reasoning: str | None = None


class DoneAction(BaseModel):
    type: Literal["done"] = "done"
    summary: str
    reasoning: str | None = None


class FailAction(BaseModel):
    type: Literal["fail"] = "fail"
    reason: str
    reasoning: str | None = None


Action = ClickAction | TypeAction | ScrollAction | SelectAction | WaitAction | DoneAction | FailAction


class AgentRequest(BaseModel):
    context: SanitisedContext
    task: str
    history: list[Action] = Field(default_factory=list)
    step: int = 0
    max_steps: int = 20


class AgentResponse(BaseModel):
    action: Action
    thought: str | None = None
