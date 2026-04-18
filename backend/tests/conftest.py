"""
conftest.py — Pytest fixtures for Sudačka mreža API integration tests.

Assumes the Payload CMS server is running at BASE_URL (default: http://localhost:4094).
Set BASE_URL environment variable to override.

Usage:
    # Start CMS first
    docker compose up -d

    # Run tests
    pytest backend/tests/ -v
"""
import os
import uuid
import pytest
import httpx
from dotenv import load_dotenv

load_dotenv()

BASE_URL = os.getenv("BASE_URL", "http://localhost:4094")
ADMIN_EMAIL = os.getenv("TEST_ADMIN_EMAIL", "testadmin@gigforge.test")
ADMIN_PASSWORD = os.getenv("TEST_ADMIN_PASSWORD", "TestAdmin123!")
MEMBER_EMAIL = os.getenv("TEST_MEMBER_EMAIL", "testmember@gigforge.test")
MEMBER_PASSWORD = os.getenv("TEST_MEMBER_PASSWORD", "TestMember123!")


# ---------------------------------------------------------------------------
# Session-scoped: base client (no auth)
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def client() -> httpx.Client:
    """Unauthenticated HTTP client pointing at the CMS API."""
    with httpx.Client(base_url=BASE_URL, timeout=30.0) as c:
        yield c


# ---------------------------------------------------------------------------
# Session-scoped: admin token + authenticated client
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def admin_token(client: httpx.Client) -> str:
    """
    Log in as admin and return the JWT token.

    If the admin account does not yet exist, attempt to create it via the
    first-register endpoint (only works on a fresh database).
    """
    # Try login first
    resp = client.post(
        "/api/users/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    if resp.status_code == 200:
        return resp.json()["token"]

    # Create admin on first run (first-register endpoint)
    reg = client.post(
        "/api/users/first-register",
        json={"name": "Test Admin", "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    assert reg.status_code in (200, 201), (
        f"Could not create or log in admin user. "
        f"Register: {reg.status_code} {reg.text}"
    )
    # Now promote to admin role via Payload direct (only works if we already have a token)
    token = reg.json().get("token")
    return token


@pytest.fixture(scope="session")
def admin_client(admin_token: str) -> httpx.Client:
    """Authenticated HTTP client with admin JWT."""
    with httpx.Client(
        base_url=BASE_URL,
        timeout=30.0,
        headers={"Authorization": f"Bearer {admin_token}"},
    ) as c:
        yield c


# ---------------------------------------------------------------------------
# Session-scoped: member token + authenticated client
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def member_token(admin_client: httpx.Client) -> str:
    """
    Create a member-role user and return its JWT token.
    Uses admin client to create the user directly.
    """
    unique = uuid.uuid4().hex[:8]
    email = f"member_{unique}@gigforge.test"
    password = os.getenv("TEST_MEMBER_PASSWORD", "MemberPass123!")

    resp = admin_client.post(
        "/api/users",
        json={
            "name": f"Test Member {unique}",
            "email": email,
            "password": password,
            "role": "member",
        },
    )
    assert resp.status_code in (200, 201), f"Failed to create member: {resp.text}"

    # Log in as the new member
    login = admin_client.post(  # use base client (no auth header needed)
        "/api/users/login",
        json={"email": email, "password": password},
        headers={},  # explicitly strip auth header for this request
    )
    assert login.status_code == 200, f"Member login failed: {login.text}"
    return login.json()["token"]


@pytest.fixture(scope="session")
def member_client(member_token: str) -> httpx.Client:
    """Authenticated HTTP client with member JWT."""
    with httpx.Client(
        base_url=BASE_URL,
        timeout=30.0,
        headers={"Authorization": f"Bearer {member_token}"},
    ) as c:
        yield c


# ---------------------------------------------------------------------------
# Function-scoped: seed helpers
# ---------------------------------------------------------------------------

@pytest.fixture
def sample_court(admin_client: httpx.Client) -> dict:
    """Create a court record for testing and clean up after the test."""
    unique = uuid.uuid4().hex[:8]
    payload = {
        "name_hr": f"Testni Općinski Sud {unique}",
        "name_en": f"Test Municipal Court {unique}",
        "courtType": "municipal",
        "address": f"Testna ulica {unique[:4]}, 10000 Zagreb",
        "phone": "01/1234-567",
        "email": f"sud_{unique}@test.hr",
        "lat": 45.8150,
        "lng": 15.9785,
    }
    resp = admin_client.post("/api/courts", json=payload)
    assert resp.status_code in (200, 201), f"Could not create court: {resp.text}"
    court = resp.json()["doc"]

    yield court

    # Cleanup
    admin_client.delete(f"/api/courts/{court['id']}")


@pytest.fixture
def sample_decision(admin_client: httpx.Client, sample_court: dict) -> dict:
    """Create a court decision for testing and clean up after."""
    unique = uuid.uuid4().hex[:8]
    payload = {
        "title_hr": f"Presuda o naknadi štete {unique}",
        "title_en": f"Damages Judgment {unique}",
        "court": sample_court["id"],
        "decisionType": "presuda",
        "category": "gradjansko",
        "date": "2024-06-15",
        "caseNumber": f"P-{unique[:4]}/2024",
        "tags": ["test", "naknada-stete"],
    }
    resp = admin_client.post("/api/court-decisions", json=payload)
    assert resp.status_code in (200, 201), f"Could not create decision: {resp.text}"
    decision = resp.json()["doc"]

    yield decision

    admin_client.delete(f"/api/court-decisions/{decision['id']}")


@pytest.fixture
def sample_expert(admin_client: httpx.Client, sample_court: dict) -> dict:
    """Create an expert witness for testing and clean up after."""
    unique = uuid.uuid4().hex[:8]
    payload = {
        "name": f"Dr. Test Stručnjak {unique}",
        "specialityAreas": ["psihijatrija", "neurologija"],
        "languages": ["hr", "en"],
        "county": "Grad Zagreb",
        "city": "Zagreb",
        "email": f"strucnjak_{unique}@test.hr",
        "phone": f"09{unique[:8]}",
        "assignedCourts": [sample_court["id"]],
        "isVerified": True,
    }
    resp = admin_client.post("/api/expert-witnesses", json=payload)
    assert resp.status_code in (200, 201), f"Could not create expert: {resp.text}"
    expert = resp.json()["doc"]

    yield expert

    admin_client.delete(f"/api/expert-witnesses/{expert['id']}")


@pytest.fixture
def sample_interpreter(admin_client: httpx.Client) -> dict:
    """Create a court interpreter for testing and clean up after."""
    unique = uuid.uuid4().hex[:8]
    payload = {
        "name": f"Test Tumač {unique}",
        "sourceLanguages": ["engleski"],
        "targetLanguages": ["hrvatski"],
        "county": "Splitsko-dalmatinska",
        "city": "Split",
        "email": f"tumac_{unique}@test.hr",
        "isVerified": False,
    }
    resp = admin_client.post("/api/interpreters", json=payload)
    assert resp.status_code in (200, 201), f"Could not create interpreter: {resp.text}"
    interpreter = resp.json()["doc"]

    yield interpreter

    admin_client.delete(f"/api/interpreters/{interpreter['id']}")


@pytest.fixture
def sample_bankruptcy(admin_client: httpx.Client, sample_court: dict) -> dict:
    """Create a bankruptcy listing for testing and clean up after."""
    unique = uuid.uuid4().hex[:8]
    payload = {
        "caseNumber": f"St-{unique[:4]}/2024",
        "debtor": f"Test d.o.o. {unique}",
        "court": sample_court["id"],
        "assets": [
            {
                "type": "nekretnina",
                "description": "Poslovni prostor, 100 m²",
                "value": 200000,
            }
        ],
        "deadline": "2025-12-31",
        "status": "open",
        "contactEmail": f"stecaj_{unique}@test.hr",
    }
    resp = admin_client.post("/api/bankruptcy-listings", json=payload)
    assert resp.status_code in (200, 201), f"Could not create bankruptcy listing: {resp.text}"
    listing = resp.json()["doc"]

    yield listing

    admin_client.delete(f"/api/bankruptcy-listings/{listing['id']}")
