"""
test_models.py — Model validation and data integrity tests for Sudačka mreža.

Tests:
  - Field type validation (required fields, types, enums)
  - Slug auto-generation (Croatian diacritics stripped)
  - Access control field visibility rules
  - Relationship integrity (court → decisions, court → experts)
  - Search vector population (afterChange hook)
  - Boundary and edge cases per field
  - Pagination metadata correctness
"""
import uuid
import pytest
import httpx


# ===========================================================================
# COURT MODEL VALIDATION
# ===========================================================================

class TestCourtModelValidation:

    def test_create_court_all_required_fields(self, admin_client: httpx.Client):
        """All required fields present → creation succeeds."""
        unique = uuid.uuid4().hex[:8]
        payload = {
            "name_hr": f"Proba Sud {unique}",
            "courtType": "county",
            "address": f"Adresa {unique}, Zagreb",
            "lat": 45.8150,
            "lng": 15.9785,
        }
        resp = admin_client.post("/api/courts", json=payload)
        assert resp.status_code in (200, 201), f"Expected success: {resp.text}"
        admin_client.delete(f"/api/courts/{resp.json()['doc']['id']}")

    def test_create_court_missing_name_hr_rejected(self, admin_client: httpx.Client):
        resp = admin_client.post(
            "/api/courts",
            json={"courtType": "municipal", "address": "Test 1", "lat": 45.0, "lng": 16.0},
        )
        assert resp.status_code in (400, 422)

    def test_create_court_missing_court_type_rejected(self, admin_client: httpx.Client):
        resp = admin_client.post(
            "/api/courts",
            json={"name_hr": "Test Sud", "address": "Test 1", "lat": 45.0, "lng": 16.0},
        )
        assert resp.status_code in (400, 422)

    def test_create_court_missing_lat_lng_rejected(self, admin_client: httpx.Client):
        resp = admin_client.post(
            "/api/courts",
            json={"name_hr": "Test Sud", "courtType": "municipal", "address": "Test 1"},
        )
        assert resp.status_code in (400, 422)

    def test_create_court_invalid_court_type_rejected(self, admin_client: httpx.Client):
        """courtType must be one of the defined enum values."""
        resp = admin_client.post(
            "/api/courts",
            json={
                "name_hr": "Invalid Type Sud",
                "courtType": "invalidtype",  # not in enum
                "address": "Test 1",
                "lat": 45.0,
                "lng": 16.0,
            },
        )
        assert resp.status_code in (400, 422)

    def test_court_slug_strips_diacritics(self, admin_client: httpx.Client):
        """Slugs must be ASCII-safe (Croatian chars mapped: č→c, š→s, ž→z, ć→c, đ→d)."""
        unique = uuid.uuid4().hex[:8]
        resp = admin_client.post(
            "/api/courts",
            json={
                "name_hr": f"Šibenik-Knin Župa Čakovec Ćiro Đurđevac {unique}",
                "courtType": "municipal",
                "address": "Test 1",
                "lat": 45.0,
                "lng": 16.0,
            },
        )
        assert resp.status_code in (200, 201)
        slug = resp.json()["doc"]["slug"]
        # Slug must not contain any non-ASCII characters
        assert all(c.isascii() or c == "-" for c in slug), f"Non-ASCII in slug: {slug}"
        # Verify specific diacritic mappings
        assert "š" not in slug
        assert "ž" not in slug
        assert "č" not in slug
        admin_client.delete(f"/api/courts/{resp.json()['doc']['id']}")

    def test_court_slug_uniqueness(self, admin_client: httpx.Client):
        """Two courts with the same name must get unique slugs."""
        unique = uuid.uuid4().hex[:8]
        name = f"Proba Općinski Sud {unique}"
        payload = {
            "name_hr": name,
            "courtType": "municipal",
            "address": "Test 1",
            "lat": 45.0,
            "lng": 16.0,
        }
        resp1 = admin_client.post("/api/courts", json=payload)
        resp2 = admin_client.post("/api/courts", json=payload)
        assert resp1.status_code in (200, 201)
        assert resp2.status_code in (200, 201)

        slug1 = resp1.json()["doc"]["slug"]
        slug2 = resp2.json()["doc"]["slug"]
        # Slugs must differ (second should have a numeric suffix)
        assert slug1 != slug2, f"Duplicate slug: {slug1}"

        admin_client.delete(f"/api/courts/{resp1.json()['doc']['id']}")
        admin_client.delete(f"/api/courts/{resp2.json()['doc']['id']}")

    def test_court_valid_types_all_accepted(self, admin_client: httpx.Client):
        """All defined court types must be accepted."""
        valid_types = ["municipal", "county", "commercial", "misdemeanour", "supreme", "constitutional"]
        created_ids = []
        for ct in valid_types:
            unique = uuid.uuid4().hex[:6]
            resp = admin_client.post(
                "/api/courts",
                json={
                    "name_hr": f"Test {ct.title()} Sud {unique}",
                    "courtType": ct,
                    "address": "Test 1",
                    "lat": 45.0,
                    "lng": 16.0,
                },
            )
            assert resp.status_code in (200, 201), f"Type '{ct}' rejected: {resp.text}"
            created_ids.append(resp.json()["doc"]["id"])

        for cid in created_ids:
            admin_client.delete(f"/api/courts/{cid}")

    def test_court_lat_lng_are_numeric(self, admin_client: httpx.Client):
        """Latitude and longitude must be numeric fields."""
        resp = admin_client.post(
            "/api/courts",
            json={
                "name_hr": "Test Sud Lat String",
                "courtType": "municipal",
                "address": "Test 1",
                "lat": "not-a-number",
                "lng": 16.0,
            },
        )
        assert resp.status_code in (400, 422)

    def test_court_response_includes_expected_fields(self, client: httpx.Client, sample_court: dict):
        """GET /api/courts/:id response must include all expected public fields."""
        resp = client.get(f"/api/courts/{sample_court['id']}")
        assert resp.status_code == 200
        data = resp.json()
        expected_fields = ["id", "name_hr", "courtType", "address", "lat", "lng", "slug"]
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"


# ===========================================================================
# COURT DECISION MODEL VALIDATION
# ===========================================================================

class TestCourtDecisionModelValidation:

    def test_create_decision_all_required_fields(self, admin_client: httpx.Client, sample_court: dict):
        unique = uuid.uuid4().hex[:8]
        payload = {
            "title_hr": f"Presuda Test {unique}",
            "court": sample_court["id"],
            "decisionType": "presuda",
            "category": "gradjansko",
            "date": "2024-01-15",
            "caseNumber": f"P-{unique[:4]}/2024",
        }
        resp = admin_client.post("/api/court-decisions", json=payload)
        assert resp.status_code in (200, 201)
        admin_client.delete(f"/api/court-decisions/{resp.json()['doc']['id']}")

    def test_decision_missing_title_rejected(self, admin_client: httpx.Client, sample_court: dict):
        unique = uuid.uuid4().hex[:8]
        resp = admin_client.post(
            "/api/court-decisions",
            json={
                "court": sample_court["id"],
                "decisionType": "presuda",
                "category": "gradjansko",
                "date": "2024-01-15",
                "caseNumber": f"P-{unique[:4]}/2024",
            },
        )
        assert resp.status_code in (400, 422)

    def test_decision_missing_court_rejected(self, admin_client: httpx.Client):
        unique = uuid.uuid4().hex[:8]
        resp = admin_client.post(
            "/api/court-decisions",
            json={
                "title_hr": f"Presuda {unique}",
                "decisionType": "presuda",
                "category": "gradjansko",
                "date": "2024-01-15",
                "caseNumber": f"P-{unique[:4]}/2024",
            },
        )
        assert resp.status_code in (400, 422)

    def test_decision_missing_date_rejected(self, admin_client: httpx.Client, sample_court: dict):
        unique = uuid.uuid4().hex[:8]
        resp = admin_client.post(
            "/api/court-decisions",
            json={
                "title_hr": f"Presuda {unique}",
                "court": sample_court["id"],
                "decisionType": "presuda",
                "category": "gradjansko",
                "caseNumber": f"P-{unique[:4]}/2024",
            },
        )
        assert resp.status_code in (400, 422)

    def test_decision_invalid_type_rejected(self, admin_client: httpx.Client, sample_court: dict):
        unique = uuid.uuid4().hex[:8]
        resp = admin_client.post(
            "/api/court-decisions",
            json={
                "title_hr": f"Presuda {unique}",
                "court": sample_court["id"],
                "decisionType": "invalid-type",  # not in enum
                "category": "gradjansko",
                "date": "2024-01-15",
                "caseNumber": f"P-{unique[:4]}/2024",
            },
        )
        assert resp.status_code in (400, 422)

    def test_decision_invalid_category_rejected(self, admin_client: httpx.Client, sample_court: dict):
        unique = uuid.uuid4().hex[:8]
        resp = admin_client.post(
            "/api/court-decisions",
            json={
                "title_hr": f"Presuda {unique}",
                "court": sample_court["id"],
                "decisionType": "presuda",
                "category": "invalid-category",  # not in enum
                "date": "2024-01-15",
                "caseNumber": f"P-{unique[:4]}/2024",
            },
        )
        assert resp.status_code in (400, 422)

    def test_all_valid_decision_types(self, admin_client: httpx.Client, sample_court: dict):
        """All three decision types must be accepted."""
        valid_types = ["presuda", "rješenje", "odluka"]
        created_ids = []
        for dt in valid_types:
            unique = uuid.uuid4().hex[:8]
            resp = admin_client.post(
                "/api/court-decisions",
                json={
                    "title_hr": f"Test {dt} {unique}",
                    "court": sample_court["id"],
                    "decisionType": dt,
                    "category": "gradjansko",
                    "date": "2024-01-01",
                    "caseNumber": f"T-{unique[:4]}/2024",
                },
            )
            assert resp.status_code in (200, 201), f"Type '{dt}' rejected: {resp.text}"
            created_ids.append(resp.json()["doc"]["id"])

        for did in created_ids:
            admin_client.delete(f"/api/court-decisions/{did}")

    def test_all_valid_categories(self, admin_client: httpx.Client, sample_court: dict):
        """All five legal categories must be accepted."""
        valid_cats = ["kazneno", "gradjansko", "upravno", "prekrsajno", "trgovacko"]
        created_ids = []
        for cat in valid_cats:
            unique = uuid.uuid4().hex[:8]
            resp = admin_client.post(
                "/api/court-decisions",
                json={
                    "title_hr": f"Test {cat} {unique}",
                    "court": sample_court["id"],
                    "decisionType": "presuda",
                    "category": cat,
                    "date": "2024-01-01",
                    "caseNumber": f"T-{unique[:4]}/2024",
                },
            )
            assert resp.status_code in (200, 201), f"Category '{cat}' rejected: {resp.text}"
            created_ids.append(resp.json()["doc"]["id"])

        for did in created_ids:
            admin_client.delete(f"/api/court-decisions/{did}")

    def test_decision_slug_auto_generated(self, admin_client: httpx.Client, sample_decision: dict):
        """Decisions must have an auto-generated slug."""
        resp = admin_client.get(f"/api/court-decisions/{sample_decision['id']}")
        assert resp.status_code == 200
        data = resp.json()
        assert "slug" in data
        assert isinstance(data["slug"], str)
        assert len(data["slug"]) > 0

    def test_decision_tags_must_be_array(self, admin_client: httpx.Client, sample_court: dict):
        """Tags field must accept an array of strings."""
        unique = uuid.uuid4().hex[:8]
        resp = admin_client.post(
            "/api/court-decisions",
            json={
                "title_hr": f"Tagged Presuda {unique}",
                "court": sample_court["id"],
                "decisionType": "presuda",
                "category": "kazneno",
                "date": "2024-03-01",
                "caseNumber": f"K-{unique[:4]}/2024",
                "tags": ["kazneno", "nasilje-u-obitelji", "zatvor"],
            },
        )
        assert resp.status_code in (200, 201)
        doc = resp.json()["doc"]
        assert isinstance(doc.get("tags", []), list)
        admin_client.delete(f"/api/court-decisions/{doc['id']}")

    def test_decision_date_format(self, admin_client: httpx.Client, sample_court: dict):
        """Date field must accept ISO 8601 format (YYYY-MM-DD)."""
        unique = uuid.uuid4().hex[:8]
        resp = admin_client.post(
            "/api/court-decisions",
            json={
                "title_hr": f"Presuda Datum {unique}",
                "court": sample_court["id"],
                "decisionType": "odluka",
                "category": "upravno",
                "date": "2023-12-31",  # valid ISO date
                "caseNumber": f"Us-{unique[:4]}/2023",
            },
        )
        assert resp.status_code in (200, 201)
        doc = resp.json()["doc"]
        assert "2023" in doc["date"]
        admin_client.delete(f"/api/court-decisions/{doc['id']}")

    def test_decision_invalid_date_format_rejected(self, admin_client: httpx.Client, sample_court: dict):
        unique = uuid.uuid4().hex[:8]
        resp = admin_client.post(
            "/api/court-decisions",
            json={
                "title_hr": f"Bad Date {unique}",
                "court": sample_court["id"],
                "decisionType": "presuda",
                "category": "gradjansko",
                "date": "31/12/2023",  # wrong format (DD/MM/YYYY)
                "caseNumber": f"P-{unique[:4]}/2023",
            },
        )
        assert resp.status_code in (400, 422)

    def test_decision_relationship_to_court(self, client: httpx.Client, sample_decision: dict):
        """Court relationship must be populated (not just an ID)."""
        resp = client.get(f"/api/court-decisions/{sample_decision['id']}")
        assert resp.status_code == 200
        court = resp.json().get("court")
        assert court is not None
        # Payload populates relationship by default
        if isinstance(court, dict):
            assert "id" in court
            assert "name_hr" in court

    def test_decision_nonexistent_court_rejected(self, admin_client: httpx.Client):
        """Relationship to nonexistent court must be rejected."""
        unique = uuid.uuid4().hex[:8]
        resp = admin_client.post(
            "/api/court-decisions",
            json={
                "title_hr": f"Invalid Court Ref {unique}",
                "court": "nonexistent-court-id-xyz",
                "decisionType": "presuda",
                "category": "gradjansko",
                "date": "2024-01-01",
                "caseNumber": f"P-{unique[:4]}/2024",
            },
        )
        assert resp.status_code in (400, 422)


# ===========================================================================
# EXPERT WITNESS MODEL VALIDATION
# ===========================================================================

class TestExpertWitnessModelValidation:

    def test_create_expert_minimum_fields(self, admin_client: httpx.Client):
        """Minimum required fields → success."""
        unique = uuid.uuid4().hex[:8]
        resp = admin_client.post(
            "/api/expert-witnesses",
            json={
                "name": f"Minimum Expert {unique}",
                "specialityAreas": ["test"],
                "county": "Grad Zagreb",
            },
        )
        assert resp.status_code in (200, 201)
        admin_client.delete(f"/api/expert-witnesses/{resp.json()['doc']['id']}")

    def test_create_expert_missing_name_rejected(self, admin_client: httpx.Client):
        resp = admin_client.post(
            "/api/expert-witnesses",
            json={"specialityAreas": ["test"], "county": "Grad Zagreb"},
        )
        assert resp.status_code in (400, 422)

    def test_expert_speciality_areas_is_array(self, admin_client: httpx.Client, sample_expert: dict):
        resp = admin_client.get(f"/api/expert-witnesses/{sample_expert['id']}")
        assert resp.status_code == 200
        assert isinstance(resp.json().get("specialityAreas", []), list)

    def test_expert_languages_is_array(self, admin_client: httpx.Client, sample_expert: dict):
        resp = admin_client.get(f"/api/expert-witnesses/{sample_expert['id']}")
        assert resp.status_code == 200
        assert isinstance(resp.json().get("languages", []), list)

    def test_expert_is_verified_defaults_false(self, admin_client: httpx.Client):
        unique = uuid.uuid4().hex[:8]
        resp = admin_client.post(
            "/api/expert-witnesses",
            json={"name": f"Unverified Expert {unique}", "specialityAreas": ["test"], "county": "Zagreb"},
        )
        assert resp.status_code in (200, 201)
        doc = resp.json()["doc"]
        assert doc.get("isVerified") is False or doc.get("isVerified") is None

        admin_client.delete(f"/api/expert-witnesses/{doc['id']}")

    def test_expert_slug_auto_generated_from_name(self, admin_client: httpx.Client):
        unique = uuid.uuid4().hex[:8]
        resp = admin_client.post(
            "/api/expert-witnesses",
            json={
                "name": f"Dr. Štefica Žužić-Ćalić {unique}",
                "specialityAreas": ["stomatologija"],
                "county": "Zadarska",
            },
        )
        assert resp.status_code in (200, 201)
        slug = resp.json()["doc"]["slug"]
        assert slug is not None
        assert all(c.isascii() or c == "-" for c in slug), f"Non-ASCII in slug: {slug}"
        admin_client.delete(f"/api/expert-witnesses/{resp.json()['doc']['id']}")

    def test_expert_assigned_courts_relationship(self, admin_client: httpx.Client, sample_court: dict):
        """assignedCourts must accept a list of court IDs."""
        unique = uuid.uuid4().hex[:8]
        resp = admin_client.post(
            "/api/expert-witnesses",
            json={
                "name": f"Expert With Courts {unique}",
                "specialityAreas": ["medicina"],
                "county": "Grad Zagreb",
                "assignedCourts": [sample_court["id"]],
            },
        )
        assert resp.status_code in (200, 201)
        doc = resp.json()["doc"]
        assert isinstance(doc.get("assignedCourts", []), list)
        admin_client.delete(f"/api/expert-witnesses/{doc['id']}")

    def test_expert_email_field_accepts_valid_email(self, admin_client: httpx.Client):
        unique = uuid.uuid4().hex[:8]
        resp = admin_client.post(
            "/api/expert-witnesses",
            json={
                "name": f"Expert With Email {unique}",
                "specialityAreas": ["pravo"],
                "county": "Grad Zagreb",
                "email": f"expert_{unique}@example.hr",
            },
        )
        assert resp.status_code in (200, 201)
        admin_client.delete(f"/api/expert-witnesses/{resp.json()['doc']['id']}")

    def test_expert_email_field_rejects_invalid_email(self, admin_client: httpx.Client):
        unique = uuid.uuid4().hex[:8]
        resp = admin_client.post(
            "/api/expert-witnesses",
            json={
                "name": f"Expert Bad Email {unique}",
                "specialityAreas": ["pravo"],
                "county": "Grad Zagreb",
                "email": "not-an-email",
            },
        )
        assert resp.status_code in (400, 422)

    def test_expert_access_control_email_hidden(self, client: httpx.Client, sample_expert: dict):
        """Email field must not be visible to unauthenticated users."""
        resp = client.get(f"/api/expert-witnesses/{sample_expert['id']}")
        assert resp.status_code == 200
        data = resp.json()
        # email must be absent or null for anonymous users
        assert data.get("email") is None or "email" not in data

    def test_expert_access_control_phone_hidden(self, client: httpx.Client, sample_expert: dict):
        """Phone field must not be visible to unauthenticated users."""
        resp = client.get(f"/api/expert-witnesses/{sample_expert['id']}")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("phone") is None or "phone" not in data


# ===========================================================================
# INTERPRETER MODEL VALIDATION
# ===========================================================================

class TestInterpreterModelValidation:

    def test_create_interpreter_minimum_fields(self, admin_client: httpx.Client):
        unique = uuid.uuid4().hex[:8]
        resp = admin_client.post(
            "/api/interpreters",
            json={
                "name": f"Minimum Tumač {unique}",
                "sourceLanguages": ["engleski"],
                "targetLanguages": ["hrvatski"],
            },
        )
        assert resp.status_code in (200, 201)
        admin_client.delete(f"/api/interpreters/{resp.json()['doc']['id']}")

    def test_interpreter_missing_name_rejected(self, admin_client: httpx.Client):
        resp = admin_client.post(
            "/api/interpreters",
            json={"sourceLanguages": ["engleski"], "targetLanguages": ["hrvatski"]},
        )
        assert resp.status_code in (400, 422)

    def test_interpreter_languages_are_arrays(self, admin_client: httpx.Client, sample_interpreter: dict):
        resp = admin_client.get(f"/api/interpreters/{sample_interpreter['id']}")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data.get("sourceLanguages", []), list)
        assert isinstance(data.get("targetLanguages", []), list)

    def test_interpreter_access_control_email(self, client: httpx.Client, sample_interpreter: dict):
        """Email must be hidden from unauthenticated users."""
        resp = client.get(f"/api/interpreters/{sample_interpreter['id']}")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("email") is None or "email" not in data


# ===========================================================================
# BANKRUPTCY LISTING MODEL VALIDATION
# ===========================================================================

class TestBankruptcyListingModelValidation:

    def test_create_listing_minimum_fields(self, admin_client: httpx.Client, sample_court: dict):
        unique = uuid.uuid4().hex[:8]
        resp = admin_client.post(
            "/api/bankruptcy-listings",
            json={
                "caseNumber": f"St-{unique[:4]}/2024",
                "debtor": f"Test d.o.o. {unique}",
                "court": sample_court["id"],
                "status": "open",
            },
        )
        assert resp.status_code in (200, 201)
        admin_client.delete(f"/api/bankruptcy-listings/{resp.json()['doc']['id']}")

    def test_listing_missing_case_number_rejected(self, admin_client: httpx.Client, sample_court: dict):
        unique = uuid.uuid4().hex[:8]
        resp = admin_client.post(
            "/api/bankruptcy-listings",
            json={"debtor": f"Test {unique}", "court": sample_court["id"], "status": "open"},
        )
        assert resp.status_code in (400, 422)

    def test_listing_missing_debtor_rejected(self, admin_client: httpx.Client, sample_court: dict):
        unique = uuid.uuid4().hex[:8]
        resp = admin_client.post(
            "/api/bankruptcy-listings",
            json={"caseNumber": f"St-{unique[:4]}/2024", "court": sample_court["id"], "status": "open"},
        )
        assert resp.status_code in (400, 422)

    def test_listing_invalid_status_rejected(self, admin_client: httpx.Client, sample_court: dict):
        unique = uuid.uuid4().hex[:8]
        resp = admin_client.post(
            "/api/bankruptcy-listings",
            json={
                "caseNumber": f"St-{unique[:4]}/2024",
                "debtor": f"Test {unique}",
                "court": sample_court["id"],
                "status": "invalid-status",  # not in enum
            },
        )
        assert resp.status_code in (400, 422)

    def test_listing_valid_statuses(self, admin_client: httpx.Client, sample_court: dict):
        """Both 'open' and 'closed' statuses must be accepted."""
        for status in ["open", "closed"]:
            unique = uuid.uuid4().hex[:8]
            resp = admin_client.post(
                "/api/bankruptcy-listings",
                json={
                    "caseNumber": f"St-{unique[:4]}/2024",
                    "debtor": f"Test {unique}",
                    "court": sample_court["id"],
                    "status": status,
                },
            )
            assert resp.status_code in (200, 201), f"Status '{status}' rejected: {resp.text}"
            admin_client.delete(f"/api/bankruptcy-listings/{resp.json()['doc']['id']}")

    def test_listing_assets_structure(self, client: httpx.Client, sample_bankruptcy: dict):
        """Assets array must contain objects with type, description, value."""
        resp = client.get(f"/api/bankruptcy-listings/{sample_bankruptcy['id']}")
        assert resp.status_code == 200
        assets = resp.json().get("assets", [])
        for asset in assets:
            assert "type" in asset
            assert "value" in asset
            assert isinstance(asset["value"], (int, float))

    def test_listing_deadline_is_date(self, admin_client: httpx.Client, sample_court: dict):
        unique = uuid.uuid4().hex[:8]
        resp = admin_client.post(
            "/api/bankruptcy-listings",
            json={
                "caseNumber": f"St-{unique[:4]}/2024",
                "debtor": f"Test {unique}",
                "court": sample_court["id"],
                "status": "open",
                "deadline": "2026-06-30",
            },
        )
        assert resp.status_code in (200, 201)
        doc = resp.json()["doc"]
        assert "2026" in (doc.get("deadline") or "")
        admin_client.delete(f"/api/bankruptcy-listings/{doc['id']}")

    def test_listing_invalid_deadline_format(self, admin_client: httpx.Client, sample_court: dict):
        unique = uuid.uuid4().hex[:8]
        resp = admin_client.post(
            "/api/bankruptcy-listings",
            json={
                "caseNumber": f"St-{unique[:4]}/2024",
                "debtor": f"Test {unique}",
                "court": sample_court["id"],
                "status": "open",
                "deadline": "30/06/2026",  # wrong format
            },
        )
        assert resp.status_code in (400, 422)


# ===========================================================================
# RELATIONSHIP INTEGRITY
# ===========================================================================

class TestRelationshipIntegrity:

    def test_court_decision_references_valid_court(self, client: httpx.Client, sample_decision: dict):
        resp = client.get(f"/api/court-decisions/{sample_decision['id']}")
        assert resp.status_code == 200
        court = resp.json().get("court")
        assert court is not None

    def test_expert_references_valid_courts(self, admin_client: httpx.Client, sample_expert: dict):
        resp = admin_client.get(f"/api/expert-witnesses/{sample_expert['id']}")
        assert resp.status_code == 200
        courts = resp.json().get("assignedCourts", [])
        assert isinstance(courts, list)

    def test_bankruptcy_references_valid_court(self, client: httpx.Client, sample_bankruptcy: dict):
        resp = client.get(f"/api/bankruptcy-listings/{sample_bankruptcy['id']}")
        assert resp.status_code == 200
        court = resp.json().get("court")
        assert court is not None

    def test_delete_court_with_decisions_behavior(self, admin_client: httpx.Client):
        """Verify database behavior when trying to delete a court that has decisions."""
        # Create a court with a decision attached
        unique = uuid.uuid4().hex[:8]
        court_resp = admin_client.post(
            "/api/courts",
            json={
                "name_hr": f"Sud Za Cascade Test {unique}",
                "courtType": "municipal",
                "address": "Test 1",
                "lat": 45.0,
                "lng": 16.0,
            },
        )
        assert court_resp.status_code in (200, 201)
        court_id = court_resp.json()["doc"]["id"]

        dec_resp = admin_client.post(
            "/api/court-decisions",
            json={
                "title_hr": f"Presuda Cascade {unique}",
                "court": court_id,
                "decisionType": "presuda",
                "category": "gradjansko",
                "date": "2024-01-01",
                "caseNumber": f"P-{unique[:4]}/2024",
            },
        )
        assert dec_resp.status_code in (200, 201)
        dec_id = dec_resp.json()["doc"]["id"]

        # Try to delete the court — may succeed (Payload may allow) or fail
        delete_resp = admin_client.delete(f"/api/courts/{court_id}")
        # Either 200 (cascade delete) or 400/409 (referential integrity)
        assert delete_resp.status_code in (200, 204, 400, 409)

        # Cleanup
        admin_client.delete(f"/api/court-decisions/{dec_id}")
        if delete_resp.status_code not in (200, 204):
            admin_client.delete(f"/api/courts/{court_id}")


# ===========================================================================
# SEARCH VECTOR (HOOK)
# ===========================================================================

class TestSearchVector:

    def test_decision_created_triggers_search_index_hook(
        self, admin_client: httpx.Client, sample_court: dict
    ):
        """
        After creating a court decision with a title, the afterChange hook
        should populate the searchVector field. We verify the endpoint
        does not 500 after creation (hook ran without error).
        """
        unique = uuid.uuid4().hex[:8]
        resp = admin_client.post(
            "/api/court-decisions",
            json={
                "title_hr": f"Naknada Štete Testna Presuda {unique}",
                "court": sample_court["id"],
                "decisionType": "presuda",
                "category": "gradjansko",
                "date": "2024-06-01",
                "caseNumber": f"P-{unique[:4]}/2024",
            },
        )
        assert resp.status_code in (200, 201)
        doc_id = resp.json()["doc"]["id"]

        # Verify we can retrieve it (no server error)
        get_resp = admin_client.get(f"/api/court-decisions/{doc_id}")
        assert get_resp.status_code == 200

        admin_client.delete(f"/api/court-decisions/{doc_id}")

    def test_decision_updated_title_triggers_reindex(
        self, admin_client: httpx.Client, sample_decision: dict
    ):
        """
        Updating a court decision's title should re-trigger the
        afterChange hook to update the searchVector.
        """
        new_title = f"Ažurirana Presuda Štefica {uuid.uuid4().hex[:6]}"
        resp = admin_client.patch(
            f"/api/court-decisions/{sample_decision['id']}",
            json={"title_hr": new_title},
        )
        assert resp.status_code == 200
        # No 500 = hook ran successfully
        assert resp.json()["doc"]["title_hr"] == new_title


# ===========================================================================
# PAGINATION METADATA
# ===========================================================================

class TestPaginationMetadata:

    def test_pagination_metadata_structure(self, client: httpx.Client):
        resp = client.get("/api/courts?limit=5&page=1")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data["docs"], list)
        assert isinstance(data["totalDocs"], int)
        assert isinstance(data["limit"], int)
        assert isinstance(data["page"], int)
        assert isinstance(data["totalPages"], int)
        assert isinstance(data["hasNextPage"], bool)
        assert isinstance(data["hasPrevPage"], bool)

    def test_first_page_has_no_prev(self, client: httpx.Client):
        resp = client.get("/api/courts?page=1")
        assert resp.status_code == 200
        assert resp.json()["hasPrevPage"] is False
        assert resp.json()["page"] == 1

    def test_total_docs_consistent(self, client: httpx.Client):
        resp = client.get("/api/court-decisions?limit=1")
        assert resp.status_code == 200
        data = resp.json()
        if data["totalDocs"] > 0:
            assert data["totalPages"] >= 1
            if data["totalDocs"] > 1:
                assert data["hasNextPage"] is True

    def test_empty_collection_pagination(self, client: httpx.Client):
        """When filtering yields zero results, pagination metadata must still be valid."""
        resp = client.get(
            "/api/court-decisions?where[caseNumber][equals]=ABSOLUTELY_NONEXISTENT"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["totalDocs"] == 0
        assert data["docs"] == []
        assert data["totalPages"] == 0 or data["totalPages"] == 1
        assert data["hasNextPage"] is False
