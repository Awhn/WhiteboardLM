"""WhiteboardLM 백엔드 (M15) — FastAPI 채택.

선정 사유(PLAN.md 2장): Anthropic Python SDK 연동과 Phase 2 도구 실행(코드 실행 툴)을
같은 런타임에서 다루기 위해 Next.js API Route 대신 FastAPI를 선택.
"""

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from . import llm, models
from .db import Base, engine, get_db
from .schemas import (
    BoardStateDTO,
    ExecuteItemRequest,
    GenerateChecklistRequest,
    GenerateFieldsRequest,
)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="WhiteboardLM API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.put("/api/boards/{board_id}")
def import_board(board_id: str, state: BoardStateDTO, db: Session = Depends(get_db)) -> dict:
    """localStorage 스냅샷 → DB 이전. 보드 전체 상태를 통째로 교체한다."""
    board = db.get(models.Board, board_id)
    if board:
        db.delete(board)
        db.flush()

    board = models.Board(id=board_id, pointer=state.pointer, board_log=state.boardLog)
    db.add(board)
    for ws in state.workspaces:
        db.add(
            models.Workspace(
                id=ws.id,
                board_id=board_id,
                name=ws.name,
                type=ws.type,
                declaration=ws.declaration.model_dump(),
                content=ws.content,
                position=ws.position,
                size=ws.size,
                access_granted=bool(ws.accessGranted),
            )
        )
    for edge in state.edges:
        db.add(
            models.Edge(
                id=edge.id,
                board_id=board_id,
                source=edge.source,
                target=edge.target,
                type=edge.type,
                hop_limit=edge.hopLimit,
                disabled=bool(edge.disabled),
            )
        )
    for order, item in enumerate(state.checklistItems):
        db.add(
            models.ChecklistItem(
                id=item.id,
                board_id=board_id,
                workspace_id=item.workspaceId,
                title=item.title,
                tag=item.tag,
                status=item.status,
                assignee=item.assignee,
                related_workspace_id=item.relatedWorkspaceId,
                comments=item.comments,
                activity_log=item.activityLog,
                order=order,
            )
        )
    for snap in state.snapshots:
        db.add(
            models.Snapshot(
                id=snap.id,
                board_id=board_id,
                workspace_id=snap.workspaceId,
                checklist_item_id=snap.checklistItemId,
                content=snap.content,
                created_at=snap.createdAt,
            )
        )
    db.commit()
    return {
        "imported": True,
        "workspaces": len(state.workspaces),
        "edges": len(state.edges),
        "checklistItems": len(state.checklistItems),
        "snapshots": len(state.snapshots),
    }


@app.get("/api/boards/{board_id}", response_model=BoardStateDTO)
def export_board(board_id: str, db: Session = Depends(get_db)) -> BoardStateDTO:
    board = db.get(models.Board, board_id)
    if not board:
        raise HTTPException(status_code=404, detail="보드를 찾을 수 없습니다.")
    return BoardStateDTO(
        workspaces=[
            {
                "id": w.id,
                "name": w.name,
                "type": w.type,
                "declaration": w.declaration,
                "content": w.content,
                "position": w.position,
                "size": w.size,
                "accessGranted": w.access_granted,
            }
            for w in board.workspaces
        ],
        edges=[
            {
                "id": e.id,
                "source": e.source,
                "target": e.target,
                "type": e.type,
                "hopLimit": e.hop_limit,
                "disabled": e.disabled,
            }
            for e in board.edges
        ],
        pointer=board.pointer,
        checklistItems=[
            {
                "id": i.id,
                "workspaceId": i.workspace_id,
                "title": i.title,
                "tag": i.tag,
                "status": i.status,
                "assignee": i.assignee,
                "relatedWorkspaceId": i.related_workspace_id,
                "comments": i.comments,
                "activityLog": i.activity_log,
            }
            for i in sorted(board.checklist_items, key=lambda x: x.order)
        ],
        snapshots=[
            {
                "id": s.id,
                "workspaceId": s.workspace_id,
                "checklistItemId": s.checklist_item_id,
                "content": s.content,
                "createdAt": s.created_at,
            }
            for s in board.snapshots
        ],
        boardLog=board.board_log,
    )


@app.post("/api/llm/dynamic-fields")
def dynamic_fields(req: GenerateFieldsRequest) -> list[dict]:
    return llm.generate_dynamic_fields(req.name, req.type, req.purpose)


@app.post("/api/llm/checklist")
def checklist(req: GenerateChecklistRequest) -> list[str]:
    return llm.generate_checklist(
        req.name, req.type, req.purpose, [f.model_dump() for f in req.dynamicFields]
    )


@app.post("/api/llm/execute")
def execute(req: ExecuteItemRequest) -> dict:
    result = llm.execute_item(
        req.title, req.workspaceName, req.purpose, req.comment, req.context, req.toolResult
    )
    return {"result": result}
