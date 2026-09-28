import pytest

from app.security.rate_limit import RateLimiter
from app.security.log_sanitiser import sanitise_for_log
from fastapi import HTTPException


class TestRateLimiter:
    def test_allows_under_limit(self):
        limiter = RateLimiter(max_requests=5, window_seconds=60)
        for _ in range(5):
            limiter.check("test-ip")

    def test_blocks_over_limit(self):
        limiter = RateLimiter(max_requests=3, window_seconds=60)
        limiter.check("test-ip")
        limiter.check("test-ip")
        limiter.check("test-ip")
        with pytest.raises(HTTPException) as exc:
            limiter.check("test-ip")
        assert exc.value.status_code == 429

    def test_separate_keys_independent(self):
        limiter = RateLimiter(max_requests=2, window_seconds=60)
        limiter.check("ip-a")
        limiter.check("ip-a")
        limiter.check("ip-b")


class TestLogSanitiser:
    def test_redacts_email(self):
        text = "User logged in: priya.sharma@example.com"
        result = sanitise_for_log(text)
        assert "priya.sharma@example.com" not in result
        assert "[REDACTED]" in result

    def test_redacts_phone(self):
        text = "Phone: +919876543210"
        result = sanitise_for_log(text)
        assert "9876543210" not in result

    def test_redacts_aadhaar(self):
        text = "Aadhaar: 2345 6789 0123"
        result = sanitise_for_log(text)
        assert "2345 6789 0123" not in result

    def test_redacts_pan(self):
        text = "PAN: ABCDE1234F"
        result = sanitise_for_log(text)
        assert "ABCDE1234F" not in result

    def test_redacts_card(self):
        text = "Card: 4111 1111 1111 1111"
        result = sanitise_for_log(text)
        assert "4111 1111 1111 1111" not in result

    def test_preserves_non_pii(self):
        text = "Request processed in 42ms, step 3/20"
        result = sanitise_for_log(text)
        assert result == text

    def test_preserves_placeholders(self):
        text = "Element contains [EMAIL_1]"
        result = sanitise_for_log(text)
        assert "[EMAIL_1]" in result
