"""Pinned PR119 + synthetic SQLite: real routes and authority, no paid models."""

import importlib.util
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

spec = importlib.util.spec_from_file_location(
    "local_host", Path(__file__).with_name("local_personal_ai_host.py")
)
host = importlib.util.module_from_spec(spec)
spec.loader.exec_module(host)
ROOT = f"/local-editor/{host.WORKSPACE}/documents"
CONTEXT = f"/api/v1/personal-context/{host.WORKSPACE}"
HEADERS = {"X-OpenEditor-Synthetic": "1", "X-Local-Test-Actor": host.OWNER}


@pytest.fixture
def fixture(tmp_path):
    database = tmp_path / "open-editor-synthetic-test.sqlite"
    app = host.create_app(database, synthetic=True)
    with TestClient(app) as client:
        yield app, client, database
    app.state.engine.dispose()


def get(client, path, **kwargs):
    return client.get(path, headers=HEADERS, **kwargs)


def post(client, path, body):
    return client.post(path, json=body, headers=HEADERS)


def initial(client):
    doc = get(client, ROOT).json()[0]
    memories = get(client, CONTEXT).json()["memories"]
    refs = [{"memory_id": m["id"], "version": m["version"]} for m in memories]
    return doc, memories, refs


def proposal(client, doc, refs):
    response = post(
        client,
        ROOT + f"/{doc['id']}/propose",
        {"expected_revision": doc["revision"], "memories": refs},
    )
    assert response.status_code == 200, response.text
    return response.json()


def accept(client, doc, p, ids):
    return post(
        client,
        ROOT + f"/{doc['id']}/accept",
        {
            "expected_revision": doc["revision"],
            "proposal_id": p["id"],
            "selected_memory_ids": ids,
        },
    )


def test_real_routes_partial_adoption_restart_and_undo(fixture):
    _app, client, database = fixture
    doc, memories, refs = initial(client)
    checked = post(
        client,
        CONTEXT + "/editor-context",
        {
            "document_id": doc["id"],
            "document_version": doc["revision"],
            "memories": refs,
        },
    )
    assert checked.status_code == 200
    assert checked.headers["cache-control"] == "no-store"
    assert all(m["source_date"].endswith("Z") for m in checked.json()["memories"])
    p = proposal(client, doc, refs)
    applied = accept(client, doc, p, [memories[0]["id"]])
    assert applied.status_code == 200, applied.text
    applied = applied.json()
    text = str(applied["document"])
    assert memories[0]["content"] in text and memories[1]["content"] not in text
    assert applied["revision"] == doc["revision"] + 1 and applied["undoAvailable"]
    # Repeated requests cannot duplicate or silently undo the adoption.
    assert accept(client, doc, p, [memories[0]["id"]]).status_code == 409
    restarted = host.create_app(database, synthetic=True)
    with TestClient(restarted) as next_client:
        assert (
            get(next_client, ROOT + f"/{doc['id']}").json()["document"]
            == applied["document"]
        )
        undone = post(
            next_client,
            ROOT + f"/{doc['id']}/undo",
            {"expected_revision": applied["revision"]},
        )
        assert undone.status_code == 200
        assert undone.json()["document"] == doc["document"]
        assert not undone.json()["undoAvailable"]
    restarted.state.engine.dispose()


@pytest.mark.parametrize("action", ["pause", "delete"])
def test_memory_revocation_between_prepare_and_accept_is_atomic(fixture, action):
    _app, client, _ = fixture
    doc, memories, refs = initial(client)
    p = proposal(client, doc, refs)
    changed = post(
        client,
        CONTEXT + f"/memories/{memories[0]['id']}/actions",
        {"version": memories[0]["version"], "action": action},
    )
    assert changed.status_code == 200
    assert accept(client, doc, p, [m["id"] for m in memories]).status_code == 409
    assert get(client, ROOT + f"/{doc['id']}").json()["document"] == doc["document"]
    assert get(client, ROOT + f"/{doc['id']}").json()["revision"] == doc["revision"]


def test_multiple_memories_from_one_source_retain_explicit_utc(fixture):
    _, client, _ = fixture
    doc, memories, refs = initial(client)
    same_source = post(
        client,
        CONTEXT + "/memories",
        {
            "source_turn_id": memories[0]["source_turn_id"],
            "content": memories[0]["content"].rstrip("。"),
            "assertion": "user_statement",
            "kind": "fact",
            "rationale": "Synthetic second selection",
        },
    ).json()
    approved = post(
        client,
        CONTEXT + f"/memories/{same_source['id']}/actions",
        {"version": same_source["version"], "action": "approve"},
    ).json()
    response = post(
        client,
        CONTEXT + "/editor-context",
        {
            "document_id": doc["id"],
            "document_version": doc["revision"],
            "memories": [
                refs[0],
                {"memory_id": approved["id"], "version": approved["version"]},
            ],
        },
    )
    assert response.status_code == 200
    assert all(m["source_date"].endswith("Z") for m in response.json()["memories"])


def test_owner_workspace_document_and_source_boundaries(fixture):
    app, client, _ = fixture
    doc, memories, refs = initial(client)
    p = proposal(client, doc, refs)
    wrong = {**HEADERS, "X-Local-Test-Actor": host.OTHER}
    assert client.get(ROOT, headers=wrong).status_code == 403
    assert (
        client.post(
            CONTEXT + "/editor-context",
            headers=wrong,
            json={"document_id": doc["id"], "memories": refs},
        ).status_code
        == 403
    )
    assert client.get(ROOT).status_code == 401
    assert (
        client.get(
            ROOT, headers={**HEADERS, "Origin": "https://untrusted.invalid"}
        ).status_code
        == 403
    )
    assert get(client, f"/local-editor/{uuid4()}/documents").status_code == 403
    other = post(
        client, ROOT, {"title": "Other synthetic document", "document": doc["document"]}
    ).json()
    assert accept(client, other, p, [memories[0]["id"]]).status_code == 409
    assert (
        post(
            client,
            CONTEXT + "/editor-context",
            {"document_id": str(uuid4()), "memories": refs},
        ).status_code
        == 404
    )
    from personal_ai.db.models import PersonalTurnRecord

    with app.state.factory() as session:
        source = session.get(PersonalTurnRecord, memories[0]["source_turn_id"])
        source.status = "deleted"
        source.prompt = None
        source.output = None
        session.commit()
    assert accept(client, doc, p, [memories[0]["id"]]).status_code == 409


def test_stale_versions_unknown_selection_and_human_edits(fixture):
    _, client, _ = fixture
    doc, memories, refs = initial(client)
    p = proposal(client, doc, refs)
    assert accept(client, doc, p, [str(uuid4())]).status_code == 409
    assert (
        accept(client, doc, p, [memories[0]["id"], memories[0]["id"]]).status_code
        == 409
    )
    stale = [{**refs[0], "version": refs[0]["version"] + 1}]
    assert (
        post(
            client,
            CONTEXT + "/editor-context",
            {
                "document_id": doc["id"],
                "document_version": doc["revision"],
                "memories": stale,
            },
        ).status_code
        == 409
    )
    changed = host.copy.deepcopy(doc["document"])
    changed["blocks"][0]["content"][0]["text"] += " Human edit"
    saved = post(
        client,
        ROOT + f"/{doc['id']}/save",
        {"expected_revision": doc["revision"], "document": changed},
    ).json()
    assert accept(client, doc, p, [memories[0]["id"]]).status_code == 409
    assert saved["document"] == changed
    p = proposal(client, saved, refs)
    applied = accept(client, saved, p, [memories[0]["id"]]).json()
    later = post(
        client,
        ROOT + f"/{doc['id']}/save",
        {"expected_revision": applied["revision"], "document": changed},
    ).json()
    assert (
        post(
            client,
            ROOT + f"/{doc['id']}/undo",
            {"expected_revision": later["revision"]},
        ).status_code
        == 409
    )
    assert get(client, ROOT + f"/{doc['id']}").json()["document"] == changed


def test_undo_cannot_resurrect_previously_deleted_memory(fixture):
    _, client, _ = fixture
    doc, memories, refs = initial(client)
    first = accept(
        client, doc, proposal(client, doc, [refs[0]]), [memories[0]["id"]]
    ).json()
    second = accept(
        client, first, proposal(client, first, [refs[1]]), [memories[1]["id"]]
    ).json()
    assert (
        post(
            client,
            CONTEXT + f"/memories/{memories[0]['id']}/actions",
            {"version": memories[0]["version"], "action": "delete"},
        ).status_code
        == 200
    )
    assert (
        post(
            client,
            ROOT + f"/{doc['id']}/undo",
            {"expected_revision": second["revision"]},
        ).status_code
        == 409
    )
    assert get(client, ROOT + f"/{doc['id']}").json()["document"] == second["document"]


def test_failed_commit_rolls_back_verification_audit_and_entire_document(
    fixture, monkeypatch
):
    app, client, _ = fixture
    doc, memories, refs = initial(client)
    p = proposal(client, doc, refs)
    from personal_ai.db.models import AuditEventRecord

    with app.state.factory() as session:
        before = len(list(session.scalars(select(AuditEventRecord))))
    commit = host.DeferredSession.commit

    def fail_commit(session):
        if not session.defer_commit:
            raise RuntimeError("Synthetic disk failure")
        return commit(session)

    with monkeypatch.context() as scoped:
        scoped.setattr(host.DeferredSession, "commit", fail_commit)
        with TestClient(app, raise_server_exceptions=False) as failing:
            assert accept(failing, doc, p, [memories[0]["id"]]).status_code == 500
    assert get(client, ROOT + f"/{doc['id']}").json()["document"] == doc["document"]
    with app.state.factory() as session:
        assert len(list(session.scalars(select(AuditEventRecord)))) == before


def test_concurrent_writers_compare_and_swap_one_winner(fixture):
    _, client, _ = fixture
    doc, _, _ = initial(client)
    from concurrent.futures import ThreadPoolExecutor

    def write(label):
        changed = host.copy.deepcopy(doc["document"])
        changed["blocks"][0]["content"][0]["text"] = label
        return post(
            client,
            ROOT + f"/{doc['id']}/save",
            {"expected_revision": doc["revision"], "document": changed},
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(write, ["Synthetic tab A", "Synthetic tab B"]))
    assert sorted(r.status_code for r in responses) == [200, 409]
    winner = next(r.json() for r in responses if r.status_code == 200)
    assert get(client, ROOT + f"/{doc['id']}").json()["document"] == winner["document"]


def test_corrupt_oversized_duplicate_and_identity_payloads_are_rejected(fixture):
    _, client, _ = fixture
    doc, _, _ = initial(client)
    for invalid in (
        {"schemaVersion": 99, "blocks": []},
        {"schemaVersion": 1, "blocks": doc["document"]["blocks"] * 2},
    ):
        assert (
            post(client, ROOT, {"title": "Invalid", "document": invalid}).status_code
            == 422
        )
    assert (
        post(
            client,
            ROOT,
            {"title": "Invalid", "document": doc["document"], "actor_id": host.OTHER},
        ).status_code
        == 422
    )
    assert (
        post(
            client,
            ROOT + f"/{doc['id']}/save",
            {"expected_revision": 999, "document": doc["document"]},
        ).status_code
        == 409
    )
    assert get(client, ROOT + f"/{doc['id']}").json()["revision"] == doc["revision"]
