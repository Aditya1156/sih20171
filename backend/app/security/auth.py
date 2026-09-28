import os

from fastapi import Header, HTTPException


def verify_token(authorization: str = Header(...)) -> str:
    expected = os.environ.get("BACKEND_API_TOKEN")
    if not expected:
        raise HTTPException(status_code=500, detail="Server misconfigured: no API token set")

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header format")

    token = authorization.removeprefix("Bearer ").strip()
    if token != expected:
        raise HTTPException(status_code=401, detail="Invalid token")

    return token
