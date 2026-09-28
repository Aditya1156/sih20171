from __future__ import annotations

import time
from collections import defaultdict

from fastapi import HTTPException, Request


class RateLimiter:
    def __init__(self, max_requests: int = 30, window_seconds: int = 60) -> None:
        self._max = max_requests
        self._window = window_seconds
        self._hits: dict[str, list[float]] = defaultdict(list)

    def check(self, key: str) -> None:
        now = time.monotonic()
        window_start = now - self._window
        hits = self._hits[key]
        self._hits[key] = [t for t in hits if t > window_start]

        if len(self._hits[key]) >= self._max:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded: {self._max} requests per {self._window}s",
            )

        self._hits[key].append(now)


rate_limiter = RateLimiter()


async def check_rate_limit(request: Request) -> None:
    client_ip = request.client.host if request.client else "unknown"
    rate_limiter.check(client_ip)
