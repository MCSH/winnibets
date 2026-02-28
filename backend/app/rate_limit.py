"""In-memory rate limiter (FR11).

Tracks per-user request counts with a sliding window.
Each user+action pair has a deque of timestamps; old entries beyond
the window are pruned on each check.
"""

import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException

from app.config import settings


# Storage: {(user_id, action): deque([timestamp, ...])}
_buckets: dict[tuple[int, str], deque] = defaultdict(deque)
_lock = threading.Lock()

# Window in seconds (1 hour)
_WINDOW = 3600


def _reset() -> None:
    """Clear all rate limit state (for test isolation)."""
    with _lock:
        _buckets.clear()


def check_rate_limit(user_id: int, action: str) -> None:
    """Check and record a rate-limited action for a user.

    Actions:
      - "submission": limited to settings.rate_limit_submissions_per_hour
      - "bet_invitation": limited to settings.rate_limit_bet_invitations_per_hour

    Raises HTTPException(429) with Retry-After header if the limit is exceeded.

    Thread-safe: uses a lock to prevent concurrent modifications.
    """
    limits = {
        "submission": settings.rate_limit_submissions_per_hour,
        "bet_invitation": settings.rate_limit_bet_invitations_per_hour,
    }
    max_requests = limits.get(action)
    if max_requests is None:
        return  # No limit for unknown actions

    with _lock:
        now = time.time()
        key = (user_id, action)
        bucket = _buckets[key]

        # Prune entries older than the window
        cutoff = now - _WINDOW
        while bucket and bucket[0] < cutoff:
            bucket.popleft()

        if len(bucket) >= max_requests:
            # Calculate when the oldest entry will expire
            retry_after = int(bucket[0] + _WINDOW - now) + 1
            raise HTTPException(
                status_code=429,
                detail={
                    "code": "RATE_LIMIT_EXCEEDED",
                    "message": f"Rate limit exceeded for {action}. Try again later.",
                },
                headers={"Retry-After": str(retry_after)},
            )

        # Record this request
        bucket.append(now)
