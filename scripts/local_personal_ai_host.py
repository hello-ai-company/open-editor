"""Isolated synthetic loopback fixture mounting unmodified Personal-AI PR120 APIs.

No production authentication, worker, model call, or external database is used.
PERSONAL_AI_SOURCE must point at the exact archived PR120 source below.
"""

import argparse
import hashlib
import os
import re
import sys
from datetime import UTC
from pathlib import Path
from typing import Annotated
from uuid import UUID, uuid4

SOURCE_SHA = "b4e541c49b2e5b3c6988dc48b99532b6c89aaa74"
OWNER = "00000000-0000-4000-8000-000000000101"
WORKSPACE = "00000000-0000-4000-8000-000000000102"
OTHER = "00000000-0000-4000-8000-000000000103"
source = Path(os.environ["PERSONAL_AI_SOURCE"]).resolve()
for name, expected in {
    "services/personal_document.py": "ed100d116c85f6b6c9f0ed086d681c80c78c76046eb37212f222b6ae4e306f53",
    "models/personal_document.py": "1f38d79b4549b94bb9055352ea0851d20f6210bf6645ab664d7290c2aad6a799",
    "api/v1/openeditor_restore.py": "bb70e5cd8b80eecdc020dde2307a1172ca239a8bd44ad4adc45aed31c8f705c9",
    "services/recording_bridge.py": "9f0079f95655a616cef4542190a9d7f8ea4116deb4d1469f840b944a400836eb",
}.items():
    if (
        hashlib.sha256(
            (source / "apps/api/personal_ai" / name).read_bytes()
        ).hexdigest()
        != expected
    ):
        raise RuntimeError(
            "Personal-AI PR120 source does not match the pinned contract"
        )
sys.path.insert(0, str(source / "apps/api"))
os.environ["APP_ENV"] = "test"

from fastapi import Depends, FastAPI, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from personal_ai.api.v1.openeditor_restore import router as restore_router
from personal_ai.api.v1.personal_context import router as context_router
from personal_ai.api.v1.recording_bridge import router as bridge_router
from personal_ai.api.v1.routes import router as documents_router
from personal_ai.core.errors import ApiError, api_error_handler
from personal_ai.db.base import Base, make_engine
from personal_ai.db.models import (
    DocumentRecord,
    PersonalTurnRecord,
    UserRecord,
    WorkspaceMemberRecord,
    WorkspaceRecord,
)
from personal_ai.models.blocks import Block, TextContent
from personal_ai.models.common import PrivacyLevel
from personal_ai.models.personal_context import (
    CandidateCreate,
    MemoryAction,
    TurnCreate,
)
from personal_ai.repositories import SqlAlchemyRepository
from personal_ai.services.auth import current_actor
from personal_ai.services.persistence import get_repository
from personal_ai.services.personal_context import PersonalContext, fail
from sqlalchemy import event, select
from sqlalchemy.orm import Session, object_session, sessionmaker
from sqlalchemy.orm.attributes import set_committed_value


class LocalSession(Session):
    pass


@event.listens_for(LocalSession, "loaded_as_persistent")
def restore_sqlite_utc(session, record):
    # SQLite loses offsets for this locally seeded UTC column. External source
    # files and externally supplied timestamps are never rewritten.
    if isinstance(record, PersonalTurnRecord) and record.created_at.tzinfo is None:
        set_committed_value(record, "created_at", record.created_at.replace(tzinfo=UTC))


@event.listens_for(PersonalTurnRecord, "refresh")
def refresh_sqlite_utc(record, context, attributes):
    if isinstance(object_session(record), LocalSession):
        restore_sqlite_utc(object_session(record), record)


def create_app(database: Path, *, synthetic: bool):
    if not synthetic or not database.name.startswith("open-editor-synthetic-"):
        raise RuntimeError(
            "An isolated synthetic SQLite filename and explicit opt-in are required"
        )
    engine = make_engine(f"sqlite+pysqlite:///{database.resolve()}")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, class_=LocalSession, expire_on_commit=False)
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
            repository = SqlAlchemyRepository(session)
            document = repository.create_document(
                UUID(WORKSPACE),
                "Synthetic local document",
                UUID(OWNER),
                PrivacyLevel.personal,
                {"open_editor_synthetic": True},
            )
            repository.upsert_block(
                Block(
                    document_id=UUID(document.id),
                    workspace_id=UUID(WORKSPACE),
                    type="paragraph",
                    position="00000000",
                    content=TextContent(text="合成ユーザーのローカル文書"),
                ),
                UUID(WORKSPACE),
                UUID(OWNER),
            )

    app = FastAPI(title="OpenEditor synthetic fixture — not production")
    app.state.factory = factory
    app.state.engine = engine
    app.add_exception_handler(ApiError, api_error_handler)
    origins = [f"http://127.0.0.1:{port}" for port in (5176, 5177)]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_methods=["GET", "POST", "PUT"],
        allow_headers=["Content-Type", "X-OpenEditor-Synthetic", "X-Local-Test-Actor"],
    )

    @app.middleware("http")
    async def local_only(request: Request, call_next):
        allowed = (
            request.method == "OPTIONS"
            or request.method == "GET"
            and re.fullmatch(
                r"/api/v1/documents/[0-9a-f-]+(?:/versions)?", request.url.path
            )
            or request.method == "POST"
            and request.url.path == "/api/v1/documents"
            or request.method == "PUT"
            and re.fullmatch(
                r"/api/v1/documents/[0-9a-f-]+/blocks/restore", request.url.path
            )
            or request.method == "POST"
            and re.fullmatch(
                r"/api/v1/personal-context/[0-9a-f-]+/editor-context", request.url.path
            )
            or request.method == "GET"
            and re.fullmatch(
                r"/local-editor/[0-9a-f-]+/(?:document-ids|memories)", request.url.path
            )
        )
        if not allowed:
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
    app.include_router(documents_router)
    app.include_router(restore_router)
    app.include_router(context_router)
    app.include_router(bridge_router)
    LocalActor = Annotated[UUID, Depends(actor)]

    @app.get("/local-editor/{workspace_id}/memories")
    def memories(workspace_id: UUID, actor_id: LocalActor):
        with factory() as session:
            service = PersonalContext(
                SqlAlchemyRepository(session), workspace_id, actor_id
            )
            service.lock()
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

    @app.get("/local-editor/{workspace_id}/document-ids")
    def document_ids(workspace_id: UUID, actor_id: LocalActor):
        with factory() as session:
            service = PersonalContext(
                SqlAlchemyRepository(session), workspace_id, actor_id
            )
            service.lock()
            return list(
                session.scalars(
                    select(DocumentRecord.id).where(
                        DocumentRecord.workspace_id == str(workspace_id),
                        DocumentRecord.created_by == str(actor_id),
                        DocumentRecord.deleted_at.is_(None),
                    )
                )
            )

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
