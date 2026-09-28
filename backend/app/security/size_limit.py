from __future__ import annotations

from fastapi import HTTPException, Request

MAX_BODY_BYTES = 10 * 1024 * 1024  # 10 MB


async def check_request_size(request: Request) -> None:
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_BODY_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Request body too large. Maximum: {MAX_BODY_BYTES} bytes",
        )
