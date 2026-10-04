"""Pinned PR120 owner read/save/history endpoints against isolated SQLite."""

import importlib.util
from pathlib import Path
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event, select

spec = importlib.util.spec_from_file_location(
    "local_host", Path(__file__).with_name("local_personal_ai_host.py")
)
host = importlib.util.module_from_spec(spec)
spec.loader.exec_module(host)
HEADERS = {"X-OpenEditor-Synthetic": "1", "X-Local-Test-Actor": host.OWNER}
ROOT = f"/local-editor/{host.WORKSPACE}"
CONTEXT = f"/api/v1/personal-context/{host.WORKSPACE}/editor-context"


@pytest.fixture
def fixture(tmp_path):
    database = tmp_path / "open-editor-synthetic-test.sqlite"
    app = host.create_app(database, synthetic=True)
    with TestClient(app) as client:
        yield app, client, database
    app.state.engine.dispose()


def get(client, path, headers=HEADERS):
    return client.get(path, headers=headers)


def initial(client):
    identifier = get(client, ROOT + "/document-ids").json()[0]
    doc = get(client, f"/api/v1/documents/{identifier}?personal_owner=true").json()
    memories = get(client, ROOT + "/memories").json()
    return (
        doc,
        memories,
        [{"memory_id": m["id"], "version": m["version"]} for m in memories],
    )


def read(client, doc):
    return get(client, f"/api/v1/documents/{doc['id']}?personal_owner=true")


def versions(client, doc):
    return get(client, f"/api/v1/documents/{doc['id']}/versions").json()


def save(client, doc, blocks, refs=None, title="Synthetic edited", token=None):
    return client.put(
        f"/api/v1/documents/{doc['id']}/blocks/restore",
        headers=HEADERS,
        json={
            "expected_content_revision": doc["content_revision"]
            if token is None
            else token,
            "blocks": blocks,
            "personal_save": {
                "expected_document_version": doc["version"],
                "title": title,
                "history_name": "Before OpenEditor AI review",
                "memories": refs or [],
            },
        },
    )


def paragraph(doc, text):
    return {
        "id": str(uuid4()),
        "document_id": doc["id"],
        "workspace_id": host.WORKSPACE,
        "parent_block_id": None,
        "type": "paragraph",
        "position": "00000001",
        "content": {"kind": "text", "text": text, "marks": []},
        "version": 1,
    }


def test_actual_context_partial_adoption_restart_and_undo(fixture):
    _app, client, database = fixture
    doc, memories, refs = initial(client)
    assert doc["personal_save_contract"] == "owner_cas_history_v1"
    verified = client.post(
        CONTEXT,
        headers=HEADERS,
        json={
            "document_id": doc["id"],
            "document_version": doc["version"],
            "memories": refs,
        },
    )
    assert verified.status_code == 200, verified.text
    assert all(m["source_date"].endswith("Z") for m in verified.json()["memories"])
    blocks = doc["blocks"] + [paragraph(doc, memories[0]["content"])]
    result = save(client, doc, blocks, refs)
    assert result.status_code == 200, result.text
    assert result.json()["document_version"] == doc["version"] + 1
    assert save(client, doc, blocks, refs).status_code == 409
    restarted = host.create_app(database, synthetic=True)
    with TestClient(restarted) as next_client:
        current = read(next_client, doc).json()
        assert memories[0]["content"] in str(current["blocks"])
        assert memories[1]["content"] not in str(current["blocks"])
        history = versions(next_client, doc)[0]
        assert history["title"] == doc["title"]
        # The undo write uses the CURRENT CAS, never the historical CAS.
        restored = save(
            next_client,
            current,
            history["snapshot"]["server_blocks"],
            title=history["title"],
        )
        assert restored.status_code == 200, restored.text
        assert (
            read(next_client, doc).json()["blocks"][0]["content"]
            == doc["blocks"][0]["content"]
        )
        assert len(versions(next_client, doc)) == 2
    restarted.state.engine.dispose()


@pytest.mark.parametrize("action", ["pause", "delete"])
def test_all_preview_refs_revalidated_even_unselected_source(fixture, action):
    app, client, _ = fixture
    doc, memories, refs = initial(client)
    with app.state.factory() as session:
        service = host.PersonalContext(
            host.SqlAlchemyRepository(session), UUID(host.WORKSPACE), UUID(host.OWNER)
        )
        service.act(
            UUID(memories[1]["id"]),
            host.MemoryAction(version=memories[1]["version"], action=action),
        )
    result = save(
        client, doc, doc["blocks"] + [paragraph(doc, memories[0]["content"])], refs
    )
    assert result.status_code == 409, result.text
    assert read(client, doc).json()["version"] == doc["version"]
    assert versions(client, doc) == []


@pytest.mark.parametrize(
    "mutation",
    ["document_version", "block_revision", "foreign_block", "duplicate_block"],
)
def test_failed_cas_never_partially_writes(fixture, mutation):
    _app, client, _ = fixture
    doc, _memories, _refs = initial(client)
    before = read(client, doc).json()
    blocks = doc["blocks"] + [paragraph(doc, "Must not persist")]
    token = None
    if mutation == "document_version":
        doc = {**doc, "version": doc["version"] + 1}
    if mutation == "block_revision":
        token = "stale"
    if mutation == "foreign_block":
        blocks[1]["document_id"] = str(uuid4())
    if mutation == "duplicate_block":
        blocks.append(blocks[1])
    result = save(client, doc, blocks, token=token)
    assert result.status_code in {409, 422}, result.text
    assert read(client, doc).json() == before
    assert versions(client, doc) == []


def test_owner_and_loopback_boundaries(fixture):
    _app, client, _ = fixture
    doc, *_ = initial(client)
    foreign = {**HEADERS, "X-Local-Test-Actor": host.OTHER}
    assert read(client, doc).headers["cache-control"] == "no-store"
    assert (
        get(
            client, f"/api/v1/documents/{doc['id']}?personal_owner=true", foreign
        ).status_code
        == 403
    )
    assert client.get(ROOT + "/memories").status_code == 401
    assert (
        client.get(
            ROOT + "/memories", headers={**HEADERS, "Origin": "https://example.com"}
        ).status_code
        == 403
    )
    assert (
        client.post(
            f"/api/v1/personal-context/{host.WORKSPACE}/turns", headers=HEADERS, json={}
        ).status_code
        == 403
    )
    assert (
        client.post(
            f"/api/v1/personal-context/{host.WORKSPACE}/recording-selections",
            headers=HEADERS,
            json={},
        ).status_code
        == 403
    )


def test_commit_failure_rolls_back_blocks_history_and_audit(fixture):
    app, client, _ = fixture
    from personal_ai.db.models import AuditEventRecord

    doc, *_ = initial(client)
    with app.state.factory() as session:
        before = list(session.scalars(select(AuditEventRecord.id)))

    def fail_commit(session):
        if any(
            getattr(row, "name", None) == "Before OpenEditor AI review"
            for row in session.identity_map.values()
        ):
            raise RuntimeError("Synthetic commit failure")

    event.listen(host.LocalSession, "before_commit", fail_commit)
    try:
        with pytest.raises(Exception, match="Synthetic commit failure"):
            save(client, doc, doc["blocks"] + [paragraph(doc, "Must roll back")])
    finally:
        event.remove(host.LocalSession, "before_commit", fail_commit)
    assert read(client, doc).json()["blocks"] == doc["blocks"]
    assert versions(client, doc) == []
    with app.state.factory() as session:
        assert list(session.scalars(select(AuditEventRecord.id))) == before


def test_two_actual_request_writers_have_one_winner(fixture):
    from concurrent.futures import ThreadPoolExecutor

    _app, client, _ = fixture
    doc, *_ = initial(client)
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [
            pool.submit(save, client, doc, [paragraph(doc, text)])
            for text in ("Writer A", "Writer B")
        ]
        responses = [task.result() for task in futures]
    assert sorted(response.status_code for response in responses) == [200, 409]
    assert read(client, doc).json()["version"] == doc["version"] + 1
    assert len(versions(client, doc)) == 1


def test_history_body_cannot_restore_a_revoked_memory(fixture):
    app, client, _ = fixture
    doc, memories, refs = initial(client)
    first = save(
        client, doc, doc["blocks"] + [paragraph(doc, memories[0]["content"])], refs[:1]
    )
    assert first.status_code == 200
    current = read(client, doc).json()
    second = save(
        client,
        current,
        current["blocks"] + [paragraph(doc, memories[1]["content"])],
        refs[1:],
    )
    assert second.status_code == 200
    latest = read(client, doc).json()
    with app.state.factory() as session:
        service = host.PersonalContext(
            host.SqlAlchemyRepository(session), UUID(host.WORKSPACE), UUID(host.OWNER)
        )
        service.act(
            UUID(memories[0]["id"]),
            host.MemoryAction(version=memories[0]["version"], action="delete"),
        )
    previous = next(
        h
        for h in versions(client, doc)
        if h["snapshot"]["document_version"] == latest["version"] - 1
    )
    assert (
        save(
            client, latest, previous["snapshot"]["server_blocks"], refs[:1]
        ).status_code
        == 409
    )
    assert read(client, doc).json()["blocks"] == latest["blocks"]
    assert len(versions(client, doc)) == 2
