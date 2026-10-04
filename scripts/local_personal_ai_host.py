"""Opt-in synthetic loopback harness, never a production auth or storage adapter.

Run using the isolated PR119 environment, with PERSONAL_AI_SOURCE pointing at
its exact archived source. No Personal-AI source is modified. Its existing
editor_context service commits internally; DeferredSession retains that commit
inside this harness's encompassing SQLite transaction until the document CAS.
An upstream transaction-aware service seam is required for production adoption.
"""

import argparse
import copy
import hashlib
import json
import math
import os
import sys
from datetime import UTC
from pathlib import Path
from typing import Annotated
from uuid import UUID, uuid4

SOURCE_SHA = "7b03a8ce39581e1f1cb65599d5c2d2dced5ca044"
OWNER = "00000000-0000-4000-8000-000000000101"
WORKSPACE = "00000000-0000-4000-8000-000000000102"
OTHER = "00000000-0000-4000-8000-000000000103"
source = Path(os.environ["PERSONAL_AI_SOURCE"]).resolve()
for name, expected in {
    "services/recording_bridge.py": "6845940801da103843a8b76f0c96872671a4166e3fc93f1fb05c96ec9c415110",
    "models/recording_bridge.py": "0cfa02426bb4af81eb9467c67fa144896c28ecbf2b0d416b73255284e8598a84",
}.items():
    if (
        hashlib.sha256(
            (source / "apps/api/personal_ai" / name).read_bytes()
        ).hexdigest()
        != expected
    ):
        raise RuntimeError(
            "Personal-AI PR119 contract does not match the pinned source"
        )
sys.path.insert(0, str(source / "apps/api"))
os.environ["APP_ENV"] = "test"

from fastapi import Depends, FastAPI, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from personal_ai.api.v1.personal_context import router as context_router
from personal_ai.api.v1.recording_bridge import router as bridge_router
from personal_ai.core.errors import ApiError, api_error_handler
from personal_ai.db.base import Base, make_engine
from personal_ai.db.models import (
    DocumentRecord,
    PersonalTurnRecord,
    UserRecord,
    WorkspaceMemberRecord,
    WorkspaceRecord,
)
from personal_ai.models.personal_context import (
    CandidateCreate,
    MemoryAction,
    StrictModel,
    TurnCreate,
)
from personal_ai.models.recording_bridge import (
    EditorContextRequest,
    MemoryReference,
)
from personal_ai.repositories import SqlAlchemyRepository
from personal_ai.services.auth import current_actor
from personal_ai.services.persistence import get_repository
from personal_ai.services.personal_context import (
    PersonalContext,
    fail,
    now,
)
from personal_ai.services.recording_bridge import editor_context
from pydantic import Field
from sqlalchemy import event, select
from sqlalchemy.orm import Session, object_session, sessionmaker
from sqlalchemy.orm.attributes import set_committed_value


class DeferredSession(Session):
    defer_commit = False

    def commit(self):
        if self.defer_commit:
            self.flush()
        else:
            super().commit()


@event.listens_for(DeferredSession, "loaded_as_persistent")
def restore_sqlite_utc(session, record):
    # PR119 writes source dates in UTC; SQLite drops timezone metadata. Restore
    # this known LOCAL storage convention. Never infer an external snapshot's
    # offset or modify pinned source files.
    if isinstance(record, PersonalTurnRecord) and record.created_at.tzinfo is None:
        set_committed_value(record, "created_at", record.created_at.replace(tzinfo=UTC))


@event.listens_for(PersonalTurnRecord, "refresh")
def refresh_sqlite_utc(record, context, attributes):
    if isinstance(object_session(record), DeferredSession):
        restore_sqlite_utc(object_session(record), record)


def valid_document(value):
    if (
        not isinstance(value, dict)
        or set(value) != {"schemaVersion", "blocks"}
        or type(value["schemaVersion"]) is not int
        or value["schemaVersion"] != 1
    ):
        raise fail("invalid_document", 422)
    pending = [(value, 0)]
    nodes = 0
    while pending:
        item, depth = pending.pop()
        nodes += 1
        if nodes > 50000 or depth > 128:
            raise fail("document_too_large", 413)
        if isinstance(item, dict):
            pending.extend((v, depth + 1) for v in item.values())
        elif isinstance(item, list):
            pending.extend((v, depth + 1) for v in item)
        elif (
            isinstance(item, float)
            and not math.isfinite(item)
            or item is not None
            and not isinstance(item, (str, int, float, bool))
        ):
            raise fail("invalid_document", 422)
    if len(json.dumps(value, ensure_ascii=False, allow_nan=False)) > 4 * 1024 * 1024:
        raise fail("document_too_large", 413)
    ids = set()

    def blocks(items, depth=0):
        if not isinstance(items, list) or depth > 64:
            raise fail("invalid_document", 422)
        for block in items:
            if not isinstance(block, dict) or set(block) - {
                "id",
                "type",
                "props",
                "content",
                "children",
            }:
                raise fail("invalid_document", 422)
            if (
                not isinstance(block.get("id"), str)
                or not block["id"]
                or block["id"] in ids
                or not isinstance(block.get("type"), str)
                or not block["type"]
            ):
                raise fail("invalid_document", 422)
            ids.add(block["id"])
            if len(ids) > 20000 or (
                "props" in block and not isinstance(block["props"], dict)
            ):
                raise fail("invalid_document", 422)
            if "children" in block:
                blocks(block["children"], depth + 1)

    blocks(value["blocks"])
    return copy.deepcopy(value)


class CreateDocument(StrictModel):
    title: str = Field(min_length=1, max_length=500)
    document: dict


class SaveDocument(StrictModel):
    expected_revision: int = Field(ge=1)
    document: dict


class Propose(StrictModel):
    expected_revision: int = Field(ge=1)
    memories: list[MemoryReference] = Field(min_length=1, max_length=12)


class Accept(StrictModel):
    expected_revision: int = Field(ge=1)
    proposal_id: UUID
    selected_memory_ids: list[UUID] = Field(min_length=1, max_length=12)


class Undo(StrictModel):
    expected_revision: int = Field(ge=1)


def create_app(database: Path, *, synthetic: bool):
    if not synthetic or not database.name.startswith("open-editor-synthetic-"):
        raise RuntimeError(
            "An isolated synthetic SQLite filename and explicit opt-in are required"
        )
    engine = make_engine(f"sqlite+pysqlite:///{database.resolve()}")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, class_=DeferredSession, expire_on_commit=False)
    with factory() as session:
        if session.get(WorkspaceRecord, WORKSPACE) is None:
            if session.scalar(select(UserRecord.id)) is not None:
                raise RuntimeError("Refusing to seed an existing non-harness database")
            session.add_all(
                [
                    UserRecord(id=OWNER, display_name="Synthetic owner"),
                    UserRecord(id=OTHER, display_name="Synthetic other user"),
                ]
            )
            session.flush()
            session.add(
                WorkspaceRecord(
                    id=WORKSPACE,
                    name="Synthetic local",
                    workspace_type="personal",
                    privacy_level="personal",
                    created_by=OWNER,
                    updated_by=OWNER,
                )
            )
            session.flush()
            # Even another workspace owner cannot access this owner's memories.
            session.add_all(
                [
                    WorkspaceMemberRecord(
                        workspace_id=WORKSPACE,
                        user_id=actor,
                        role="owner",
                        created_by=OWNER,
                    )
                    for actor in (OWNER, OTHER)
                ]
            )
            session.commit()
            service = PersonalContext(
                SqlAlchemyRepository(session), UUID(WORKSPACE), UUID(OWNER)
            )
            conversation = service.create_conversation("Synthetic source conversation")
            for assertion, text in [
                ("user_statement", "合成ユーザーは短い文章を好みます。"),
                ("ai_inference", "合成ユーザーには小さな実験が役立ちそうです。"),
            ]:
                turn, _ = service.begin_turn(
                    conversation.id, TurnCreate(request_id=uuid4(), prompt=text)
                )
                turn = service.finish_turn(
                    UUID(turn.id), "Mock response; no model called", []
                )
                memory = service.add_candidate(
                    CandidateCreate(
                        source_turn_id=turn.id,
                        content=text,
                        assertion=assertion,
                        rationale="Synthetic source for local integration testing",
                    )
                )
                service.act(
                    memory.id, MemoryAction(version=memory.version, action="approve")
                )
            document = {
                "schemaVersion": 1,
                "blocks": [
                    {
                        "id": str(uuid4()),
                        "type": "paragraph",
                        "content": [
                            {
                                "type": "text",
                                "text": "合成ユーザーのローカル文書",
                                "styles": {},
                            }
                        ],
                    }
                ],
            }
            session.add(
                DocumentRecord(
                    workspace_id=WORKSPACE,
                    title="Synthetic local document",
                    privacy_level="personal",
                    created_by=OWNER,
                    metadata_={
                        "local_editor": {
                            "document": document,
                            "citations": [],
                            "proposals": {},
                            "undo": None,
                        }
                    },
                )
            )
            session.commit()

    app = FastAPI(title="OpenEditor synthetic local host — not production")
    app.state.factory = factory
    app.state.engine = engine
    app.add_exception_handler(ApiError, api_error_handler)
    origins = [f"http://127.0.0.1:{port}" for port in (5176, 5177)]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "X-OpenEditor-Synthetic", "X-Local-Test-Actor"],
    )

    @app.middleware("http")
    async def local_only(request: Request, call_next):
        if request.url.path.endswith(
            ("/turns", "/recording-selections", "/restore", "/export", "/conversations")
        ):
            return JSONResponse(
                {"code": "outside_local_editor_harness"}, status_code=403
            )
        if request.headers.get("host", "").split(":")[0] not in {
            "127.0.0.1",
            "testserver",
        } or (
            request.headers.get("origin") and request.headers["origin"] not in origins
        ):
            return JSONResponse({"code": "synthetic_loopback_only"}, status_code=403)
        if (
            request.method != "OPTIONS"
            and request.headers.get("x-openeditor-synthetic") != "1"
        ):
            return JSONResponse({"code": "synthetic_opt_in_required"}, status_code=401)
        if int(request.headers.get("content-length", "0")) > 5 * 1024 * 1024:
            return JSONResponse({"code": "request_too_large"}, status_code=413)
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        return response

    async def actor(x_local_test_actor: str | None = Header(default=None)) -> UUID:
        if x_local_test_actor not in {OWNER, OTHER}:
            raise fail("synthetic_identity_required", 401)
        return UUID(x_local_test_actor)

    def repository():
        with factory() as session:
            yield SqlAlchemyRepository(session)

    app.dependency_overrides[current_actor] = actor
    app.dependency_overrides[get_repository] = repository
    # These are the unmodified PR119 routes. No full app/worker or production auth is started.
    app.include_router(context_router)
    app.include_router(bridge_router)

    def authority(session, workspace_id, actor_id):
        service = PersonalContext(SqlAlchemyRepository(session), workspace_id, actor_id)
        service.lock()
        return service

    def owned_document(session, service, document_id, expected=None):
        row = session.get(DocumentRecord, str(document_id), populate_existing=True)
        if (
            row is None
            or row.workspace_id != service.workspace_id
            or row.deleted_at is not None
            or row.created_by != service.owner_id
            or "local_editor" not in row.metadata_
        ):
            raise fail("editor_document_unavailable", 404)
        if expected is not None and row.version != expected:
            raise fail("document_conflict")
        return row

    def envelope(row, actor_id):
        return {
            "schemaVersion": 1,
            "actorId": str(actor_id),
            "workspaceId": row.workspace_id,
            "id": row.id,
            "title": row.title,
            "revision": row.version,
            "updatedAt": row.updated_at.isoformat(),
            "document": row.metadata_["local_editor"]["document"],
            "undoAvailable": row.metadata_["local_editor"].get("undo") is not None,
        }

    def verify(session, service, row, references):
        session.defer_commit = True
        return editor_context(
            service,
            EditorContextRequest(
                document_id=UUID(row.id),
                document_version=row.version,
                memories=references,
            ),
        )

    def persist(session, row, data, actor_id):
        row.metadata_ = {**row.metadata_, "local_editor": data}
        row.version += 1
        row.updated_at = now()
        row.updated_by = str(actor_id)
        session.defer_commit = False
        session.commit()
        return envelope(row, actor_id)

    LocalActor = Annotated[UUID, Depends(actor)]
    root = "/local-editor/{workspace_id}/documents"

    @app.get("/local-editor/{workspace_id}/memories")
    def approved_memories(workspace_id: UUID, actor_id: LocalActor):
        with factory() as session:
            service = authority(session, workspace_id, actor_id)
            return [
                {
                    "id": str(m.id),
                    "version": m.version,
                    "status": m.status,
                    "content": m.content,
                    "assertion": m.assertion,
                }
                for m in service.snapshot().memories
                if m.status == "approved" and m.content
            ]

    @app.get(root)
    def documents(workspace_id: UUID, actor_id: LocalActor):
        with factory() as session:
            service = authority(session, workspace_id, actor_id)
            rows = session.scalars(
                select(DocumentRecord).where(
                    DocumentRecord.workspace_id == service.workspace_id,
                    DocumentRecord.created_by == service.owner_id,
                    DocumentRecord.deleted_at.is_(None),
                )
            ).all()
            return [
                envelope(row, actor_id)
                for row in rows
                if "local_editor" in row.metadata_
            ]

    @app.get(root + "/{document_id}")
    def load(workspace_id: UUID, document_id: UUID, actor_id: LocalActor):
        with factory() as session:
            return envelope(
                owned_document(
                    session, authority(session, workspace_id, actor_id), document_id
                ),
                actor_id,
            )

    @app.post(root)
    def create(workspace_id: UUID, payload: CreateDocument, actor_id: LocalActor):
        with factory() as session:
            authority(session, workspace_id, actor_id)
            row = DocumentRecord(
                workspace_id=str(workspace_id),
                title=payload.title,
                privacy_level="personal",
                created_by=str(actor_id),
                metadata_={
                    "local_editor": {
                        "document": valid_document(payload.document),
                        "citations": [],
                        "proposals": {},
                        "undo": None,
                    }
                },
            )
            session.add(row)
            session.commit()
            return envelope(row, actor_id)

    @app.post(root + "/{document_id}/save")
    def save(
        workspace_id: UUID,
        document_id: UUID,
        payload: SaveDocument,
        actor_id: LocalActor,
    ):
        with factory() as session:
            service = authority(session, workspace_id, actor_id)
            row = owned_document(
                session, service, document_id, payload.expected_revision
            )
            data = copy.deepcopy(row.metadata_["local_editor"])
            data["document"] = valid_document(payload.document)
            # An ordinary edit expires old proposals and undo. Existing citations
            # remain for future restore checks; they are not permission grants.
            data["proposals"] = {}
            data["undo"] = None
            return persist(session, row, data, actor_id)

    @app.post(root + "/{document_id}/propose")
    def propose(
        workspace_id: UUID,
        document_id: UUID,
        payload: Propose,
        actor_id: LocalActor,
    ):
        with factory() as session:
            service = authority(session, workspace_id, actor_id)
            row = owned_document(
                session, service, document_id, payload.expected_revision
            )
            context = verify(session, service, row, payload.memories).model_dump(
                mode="json"
            )
            proposal = {
                "id": str(uuid4()),
                "baseRevision": row.version,
                "context": context,
            }
            data = copy.deepcopy(row.metadata_["local_editor"])
            # A new preparation replaces only pending review, not content or version.
            data["proposals"] = {proposal["id"]: proposal}
            row.metadata_ = {**row.metadata_, "local_editor": data}
            session.defer_commit = False
            session.commit()
            return proposal

    @app.post(root + "/{document_id}/accept")
    def accept(
        workspace_id: UUID,
        document_id: UUID,
        payload: Accept,
        actor_id: LocalActor,
    ):
        with factory() as session:
            service = authority(session, workspace_id, actor_id)
            row = owned_document(
                session, service, document_id, payload.expected_revision
            )
            data = copy.deepcopy(row.metadata_["local_editor"])
            proposal = data["proposals"].get(str(payload.proposal_id))
            selected = [str(id_) for id_ in payload.selected_memory_ids]
            if (
                proposal is None
                or proposal["baseRevision"] != row.version
                or len(set(selected)) != len(selected)
                or set(selected)
                - {m["memory_id"] for m in proposal["context"]["memories"]}
            ):
                raise fail("invalid_local_proposal")
            memories = [
                m for m in proposal["context"]["memories"] if m["memory_id"] in selected
            ]
            if set(selected) & {m["memory_id"] for m in data["citations"]}:
                raise fail("memory_already_adopted")
            # Locks and deferred commit survive through validation AND document write.
            fresh = verify(
                session,
                service,
                row,
                [
                    MemoryReference(memory_id=m["memory_id"], version=m["version"])
                    for m in memories
                ],
            ).model_dump(mode="json")
            if fresh["memories"] != memories:
                raise fail("source_or_document_changed")
            before = copy.deepcopy(data["document"])
            before_citations = copy.deepcopy(data["citations"])
            for memory in memories:
                label = (
                    "本人発言"
                    if memory["assertion"] == "user_statement"
                    else "推測・提案"
                )
                data["document"]["blocks"].append(
                    {
                        "id": str(uuid4()),
                        "type": "paragraph",
                        "content": [
                            {
                                "type": "text",
                                "text": f"{label}: {memory['content']} (出典 {memory['source_turn_id']} · v{memory['version']})",
                                "styles": {},
                            }
                        ],
                    }
                )
            data["citations"] += [
                {"memory_id": m["memory_id"], "version": m["version"]} for m in memories
            ]
            data["undo"] = {
                "before": before,
                "before_citations": before_citations,
                "accepted_revision": row.version + 1,
                "accepted": copy.deepcopy(data["document"]),
            }
            data["proposals"] = {}
            valid_document(data["document"])
            return persist(session, row, data, actor_id)

    @app.post(root + "/{document_id}/undo")
    def undo(
        workspace_id: UUID,
        document_id: UUID,
        payload: Undo,
        actor_id: LocalActor,
    ):
        with factory() as session:
            service = authority(session, workspace_id, actor_id)
            row = owned_document(
                session, service, document_id, payload.expected_revision
            )
            data = copy.deepcopy(row.metadata_["local_editor"])
            receipt = data["undo"]
            if (
                receipt is None
                or receipt["accepted_revision"] != row.version
                or receipt["accepted"] != data["document"]
            ):
                raise fail("human_edit_conflict")
            # Removing an adopted change needs no approval. Restoring older
            # memory-derived content requires CURRENT approval, preventing resurrection.
            refs = {m["memory_id"]: m for m in receipt["before_citations"]}
            if refs:
                verify(
                    session, service, row, [MemoryReference(**m) for m in refs.values()]
                )
            data["document"] = receipt["before"]
            data["citations"] = receipt["before_citations"]
            data["undo"] = None
            data["proposals"] = {}
            return persist(session, row, data, actor_id)

    return app


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--synthetic", action="store_true")
    parser.add_argument("--database", type=Path, required=True)
    args = parser.parse_args()
    import uvicorn

    uvicorn.run(
        create_app(args.database, synthetic=args.synthetic),
        host="127.0.0.1",
        port=8189,
        access_log=False,
    )
