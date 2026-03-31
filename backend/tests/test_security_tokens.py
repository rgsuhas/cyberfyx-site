from __future__ import annotations

from datetime import timedelta

import pytest

from app.core.config import get_settings
from app.core.errors import AppError
from app.core.security import create_access_token, decode_access_token


def test_access_token_is_rejected_after_expiry() -> None:
    token = create_access_token(subject="staff-1", role="super_admin", expires_delta=timedelta(seconds=-1))

    with pytest.raises(AppError) as exc:
        decode_access_token(token)

    assert exc.value.code == "token_expired"


def test_access_token_respects_runtime_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CYBERFYX_JWT_SECRET_KEY", "runtime-secret")
    get_settings.cache_clear()

    token = create_access_token(subject="staff-2", role="sales_admin")
    payload = decode_access_token(token)

    assert payload["sub"] == "staff-2"
    assert payload["role"] == "sales_admin"

    monkeypatch.setenv("CYBERFYX_JWT_SECRET_KEY", "rotated-secret")
    get_settings.cache_clear()

    with pytest.raises(AppError) as exc:
        decode_access_token(token)

    assert exc.value.code == "invalid_token"
