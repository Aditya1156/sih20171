import os

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("BACKEND_API_TOKEN", "test-token-123")

from app.main import app
from app.schemas.models import Viewport, ScrollPosition, RedactionSummary


@pytest.fixture
def client():
    return TestClient(app)


def make_request_body(**overrides):
    defaults = {
        "context": {
            "url": "https://example.com/login",
            "title": "Login",
            "elements": [
                {"id": "ve-1", "tag": "input", "type": "text", "label": "Email", "text": "[EMAIL_1]", "is_visible": True},
                {"id": "ve-2", "tag": "input", "type": "password", "label": "Password", "is_visible": True},
                {"id": "ve-3", "tag": "button", "text": "Login", "is_visible": True},
            ],
            "viewport": {"width": 1920, "height": 1080},
            "scroll_position": {"x": 0, "y": 0},
            "timestamp": 1000000.0,
            "sensitivity_mode": "strict",
            "redaction_summary": {"total_redacted": 1, "by_type": {"EMAIL": 1}},
        },
        "task": "Log in with [EMAIL_1]",
        "history": [],
        "step": 0,
        "max_steps": 20,
    }
    defaults.update(overrides)
    return defaults


AUTH_HEADER = {"Authorization": "Bearer test-token-123"}


class TestAuth:
    def test_rejects_missing_auth(self, client):
        resp = client.post("/agent/step", json=make_request_body())
        assert resp.status_code == 422 or resp.status_code == 401

    def test_rejects_wrong_token(self, client):
        resp = client.post(
            "/agent/step",
            json=make_request_body(),
            headers={"Authorization": "Bearer wrong-token"},
        )
        assert resp.status_code == 401

    def test_rejects_malformed_auth(self, client):
        resp = client.post(
            "/agent/step",
            json=make_request_body(),
            headers={"Authorization": "NotBearer token"},
        )
        assert resp.status_code == 401


class TestStepLimit:
    def test_max_steps_returns_fail(self, client):
        body = make_request_body(step=20, max_steps=20)
        resp = client.post("/agent/step", json=body, headers=AUTH_HEADER)
        assert resp.status_code == 200
        data = resp.json()
        assert data["action"]["type"] == "fail"
        assert "Maximum steps" in data["action"]["reason"]


class TestRequestValidation:
    def test_rejects_invalid_sensitivity_mode(self, client):
        body = make_request_body()
        body["context"]["sensitivity_mode"] = "paranoid"
        resp = client.post("/agent/step", json=body, headers=AUTH_HEADER)
        assert resp.status_code == 422

    def test_rejects_missing_task(self, client):
        body = make_request_body()
        del body["task"]
        resp = client.post("/agent/step", json=body, headers=AUTH_HEADER)
        assert resp.status_code == 422

    def test_rejects_missing_context(self, client):
        body = {"task": "test", "step": 0, "max_steps": 20}
        resp = client.post("/agent/step", json=body, headers=AUTH_HEADER)
        assert resp.status_code == 422


class TestAgentResponse:
    def test_valid_request_returns_200(self, client):
        body = make_request_body()
        resp = client.post("/agent/step", json=body, headers=AUTH_HEADER)
        assert resp.status_code == 200
        data = resp.json()
        assert "action" in data
        assert data["action"]["type"] in ["click", "type", "scroll", "select", "wait", "done", "fail"]

    def test_response_contains_no_raw_pii(self, client):
        body = make_request_body()
        resp = client.post("/agent/step", json=body, headers=AUTH_HEADER)
        text = resp.text
        assert "priya.sharma@example.com" not in text
        assert "+919876543210" not in text
        assert "2345 6789 0123" not in text


class TestCORS:
    def test_cors_preflight(self, client):
        resp = client.options(
            "/agent/step",
            headers={
                "Origin": "chrome-extension://test",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Authorization,Content-Type",
            },
        )
        assert resp.status_code == 200
