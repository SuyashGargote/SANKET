"""
api/security.py — API Key authentication and in-memory rate limiting.
"""

import time
from collections import defaultdict
from threading import Lock
from typing import Optional

from fastapi import HTTPException, Query, Security, status
from fastapi.security import APIKeyHeader

from config import API_KEYS, RATE_LIMIT_PER_MINUTE

api_key_header_scheme = APIKeyHeader(name="X-API-KEY", auto_error=False)


def verify_api_key(
    header_key: Optional[str] = Security(api_key_header_scheme),
    query_key: Optional[str] = Query(None, alias="api_key", description="Optional query parameter for API key"),
) -> str:
    """
    Authenticate requests using an API key provided in:
      1. Header: 'X-API-KEY'
      2. Query param: '?api_key=...'
    """
    token = header_key or query_key
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=(
                "Missing API key. Provide header 'X-API-KEY' or '?api_key='. "
                "Default keys: 'sanket-admin-key-2026', 'sih-judge-key-2026'."
            ),
        )

    if token not in API_KEYS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Invalid API key.",
        )

    return token


def optional_or_browser_api_key(
    header_key: Optional[str] = Security(api_key_header_scheme),
    query_key: Optional[str] = Query(None, alias="api_key", description="Optional query parameter for API key"),
) -> Optional[str]:
    """
    Authenticate downloads: allows requests with valid header or query key,
    or browser-initiated direct downloads where custom headers cannot be attached.
    If an explicit invalid key is supplied, rejects with 403.
    """
    token = header_key or query_key
    if token and token not in API_KEYS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Invalid API key.",
        )
    return token or "browser_session"


class InMemoryRateLimiter:
    """Thread-safe sliding-window rate limiter per client IP."""

    def __init__(self, requests_per_minute: int = RATE_LIMIT_PER_MINUTE):
        self.limit = requests_per_minute
        self.window = 60.0  # seconds
        self.history = defaultdict(list)
        self.lock = Lock()

    def check(self, client_ip: str) -> tuple[bool, int]:
        """
        Check if request is within rate limit.
        Returns: (is_allowed, retry_after_seconds)
        """
        now = time.time()
        with self.lock:
            # Keep timestamps within the sliding window
            timestamps = [t for t in self.history[client_ip] if now - t < self.window]
            self.history[client_ip] = timestamps

            if len(timestamps) >= self.limit:
                oldest = timestamps[0]
                retry_after = max(1, int(self.window - (now - oldest)))
                return False, retry_after

            self.history[client_ip].append(now)
            return True, 0


# Global singleton rate limiter
rate_limiter = InMemoryRateLimiter(RATE_LIMIT_PER_MINUTE)
