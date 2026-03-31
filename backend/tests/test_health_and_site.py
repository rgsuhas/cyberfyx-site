from __future__ import annotations

from .helpers import extract_collection_items


def test_health_endpoints_return_ready(client):
    live = client.get("/health/live")
    ready = client.get("/health/ready")

    assert live.status_code == 200
    assert ready.status_code == 200


def test_frontend_root_and_contact_page_are_served(client):
    homepage = client.get("/")
    contact_page = client.get("/pages/contact.html")
    frontend_script = client.get("/assets/js/main.js")

    assert homepage.status_code == 200
    assert "Cyberfyx" in homepage.text

    assert contact_page.status_code == 200
    assert 'data-inquiry-form="public"' in contact_page.text

    assert frontend_script.status_code == 200
    assert "initPublicInquiryForms" in frontend_script.text
    assert "/api/v1/public/site/search-index" in frontend_script.text


def test_contact_profile_includes_office_regions_and_active_interests(client, seeded_db):
    response = client.get("/api/v1/public/site/contact-profile")

    assert response.status_code == 200
    payload = response.json()

    assert payload["profile_key"] == "primary"
    assert payload["sales_email"] == "sales@cyberfyx.net"
    assert payload["headquarters_name"] == "Cyberfyx"

    regions = extract_collection_items(payload.get("office_regions"))
    interests = extract_collection_items(payload.get("interest_options"))

    assert [region["slug"] for region in regions] == ["india", "singapore", "philippines", "dubai"]
    assert [interest["slug"] for interest in interests] == [
        "iso-consultation-services",
        "cybersecurity-services",
        "it-security-and-continuity",
        "endpoint-management-services",
        "patch-management-software",
        "power-management-software",
        "core-industry-services",
        "training",
        "general-inquiry",
    ]
    assert "legacy-support" not in {interest["slug"] for interest in interests}


def test_search_index_exposes_served_frontend_pages(client):
    response = client.get("/api/v1/public/site/search-index")

    assert response.status_code == 200
    entries = extract_collection_items(response.json())
    by_href = {entry["href"]: entry for entry in entries}

    assert "index.html" in by_href
    assert "pages/contact.html" in by_href
    assert by_href["pages/contact.html"]["title"] == "Cyberfyx - Contact Us"
    assert by_href["pages/contact.html"]["section"] == "Contact"
    assert "Submit Inquiry" in by_href["pages/contact.html"]["text"]


def test_solution_tracks_list_and_detail_hide_drafts(client, seeded_db):
    list_response = client.get("/api/v1/public/solution-tracks")
    assert list_response.status_code == 200

    tracks = extract_collection_items(list_response.json())
    slugs = [track["slug"] for track in tracks]

    assert slugs == [
        "cybersecurity",
        "it-security",
        "endpoint-operations",
        "core-industry-services",
        "training",
    ]
    assert "future-track" not in slugs

    detail_response = client.get("/api/v1/public/solution-tracks/endpoint-operations")
    assert detail_response.status_code == 200

    track = detail_response.json()
    assert track["slug"] == "endpoint-operations"
    assert track["title"] == "Endpoint operations"
    assert extract_collection_items(track["offerings"])
    assert extract_collection_items(track["endpoint_rows"])


def test_cors_preflight_rejects_unconfigured_origin(client):
    response = client.options(
        "/api/v1/public/inquiries",
        headers={
            "Origin": "https://malicious.example",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )

    assert response.status_code == 400
    assert response.headers.get("access-control-allow-origin") is None
