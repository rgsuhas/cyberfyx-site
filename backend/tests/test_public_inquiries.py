from __future__ import annotations

from .helpers import assert_problem_response, public_inquiry_payload


def test_public_inquiry_accepts_valid_payload(client, db_session, seeded_db):
    from app.models.inquiry import Inquiry
    from sqlalchemy import func, select

    payload = public_inquiry_payload(
        name="Ava Shah",
        email="ava.shah@example.com",
        company="Northwind Manufacturing",
        interest_slug="endpoint-management-services",
        message="We need help with endpoint control and patch operations.",
        source_page="/contact",
        solution_track_slug="endpoint-operations",
        cta_label="Request a consultation",
    )

    response = client.post("/api/v1/public/inquiries", json=payload)

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "new"
    assert body["id"]
    assert "received" in body["message"].lower()

    inquiry_count = db_session.scalar(
        select(func.count()).select_from(Inquiry).where(Inquiry.email == "ava.shah@example.com")
    )
    assert inquiry_count == 1


def test_public_inquiry_rejects_unknown_interest_slug(client, seeded_db):
    response = client.post(
        "/api/v1/public/inquiries",
        json=public_inquiry_payload(interest_slug="definitely-not-a-real-interest"),
    )

    assert response.status_code == 422
    assert_problem_response(response.json(), code="invalid_interest")


def test_public_inquiry_rejects_duplicates_within_window(client, seeded_db):
    payload = public_inquiry_payload(
        name="Sam Carter",
        email="sam.carter@example.com",
        company="Acme Logistics",
        interest_slug="cybersecurity-services",
        message="We need help with attack-path reduction and response readiness.",
        source_page="/contact",
        solution_track_slug="cybersecurity",
        cta_label="Request a consultation",
    )

    first_response = client.post("/api/v1/public/inquiries", json=payload)
    assert first_response.status_code == 201

    duplicate_response = client.post("/api/v1/public/inquiries", json=payload)
    assert duplicate_response.status_code == 409
    assert_problem_response(duplicate_response.json(), code="duplicate_inquiry")


def test_public_inquiry_accepts_frontend_subject_alias_and_form_encoding(client, db_session, seeded_db):
    from app.models.inquiry import Inquiry
    from sqlalchemy import select

    response = client.post(
        "/api/v1/public/inquiries",
        headers={"Referer": "https://cyberfyx.net/pages/contact.html"},
        data={
            "name": "Priya Nair",
            "email": "priya.nair@example.com",
            "subject": "endpoint",
            "message": "Need help with endpoint monitoring and patch rollouts.",
        },
    )

    assert response.status_code == 201
    body = response.json()
    saved = db_session.scalar(select(Inquiry).where(Inquiry.id == body["id"]))

    assert saved is not None
    assert saved.source_page == "/pages/contact.html"
    assert saved.referrer_url == "https://cyberfyx.net/pages/contact.html"
    assert saved.interest_option.slug == "endpoint-management-services"


def test_public_inquiry_rate_limit_allows_n_and_blocks_n_plus_1(client, seeded_db):
    base_payload = public_inquiry_payload(
        email="rate.limit@example.com",
        message="Need help validating threshold behavior.",
    )

    for idx in range(5):
        response = client.post(
            "/api/v1/public/inquiries",
            json={
                **base_payload,
                "message": f"Need help validating threshold behavior #{idx}",
            },
        )
        assert response.status_code == 201

    blocked = client.post("/api/v1/public/inquiries", json={**base_payload, "message": "One beyond the limit"})
    assert blocked.status_code == 429
    assert_problem_response(blocked.json(), code="rate_limit_exceeded")
