import pytest
from pydantic import ValidationError

from app.schemas.models import (
    AgentRequest,
    AgentResponse,
    ClickAction,
    TypeAction,
    ScrollAction,
    WaitAction,
    DoneAction,
    FailAction,
    SanitisedContext,
    RedactedElement,
    Viewport,
    ScrollPosition,
    RedactionSummary,
)


def make_context(**overrides):
    defaults = dict(
        url="https://example.com",
        title="Test",
        elements=[],
        viewport=Viewport(width=1920, height=1080),
        scroll_position=ScrollPosition(x=0, y=0),
        timestamp=1000000.0,
        sensitivity_mode="strict",
        redaction_summary=RedactionSummary(total_redacted=0),
    )
    defaults.update(overrides)
    return SanitisedContext(**defaults)


class TestActionValidation:
    def test_click_action(self):
        action = ClickAction(element_id="ve-1")
        assert action.type == "click"
        assert action.element_id == "ve-1"

    def test_type_action(self):
        action = TypeAction(element_id="ve-2", value="[EMAIL_1]")
        assert action.type == "type"
        assert action.value == "[EMAIL_1]"

    def test_scroll_action_valid_directions(self):
        for d in ["up", "down", "left", "right"]:
            action = ScrollAction(direction=d)
            assert action.direction == d

    def test_scroll_action_invalid_direction(self):
        with pytest.raises(ValidationError):
            ScrollAction(direction="diagonal")

    def test_wait_action_valid(self):
        action = WaitAction(milliseconds=1000)
        assert action.milliseconds == 1000

    def test_wait_action_zero(self):
        with pytest.raises(ValidationError):
            WaitAction(milliseconds=0)

    def test_wait_action_exceeds_max(self):
        with pytest.raises(ValidationError):
            WaitAction(milliseconds=20000)

    def test_done_action(self):
        action = DoneAction(summary="Task completed")
        assert action.type == "done"

    def test_fail_action(self):
        action = FailAction(reason="Not found")
        assert action.type == "fail"


class TestAgentRequest:
    def test_valid_request(self):
        ctx = make_context()
        req = AgentRequest(context=ctx, task="Click the login button")
        assert req.step == 0
        assert req.max_steps == 20

    def test_request_with_history(self):
        ctx = make_context()
        history = [ClickAction(element_id="ve-1")]
        req = AgentRequest(context=ctx, task="Test", history=history, step=1)
        assert len(req.history) == 1


class TestSanitisedContext:
    def test_valid_context(self):
        ctx = make_context()
        assert ctx.url == "https://example.com"
        assert ctx.sensitivity_mode == "strict"

    def test_context_with_elements(self):
        elem = RedactedElement(id="ve-1", tag="input", type="text", text="[EMAIL_1]")
        ctx = make_context(elements=[elem])
        assert len(ctx.elements) == 1
        assert ctx.elements[0].text == "[EMAIL_1]"

    def test_invalid_sensitivity_mode(self):
        with pytest.raises(ValidationError):
            make_context(sensitivity_mode="aggressive")
