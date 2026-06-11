"""M15/M16: 보드 저장/불러오기 안정성 + LLM 프록시 폴백 테스트 (SQLite 인메모리)."""

import os
import sys

os.environ["DATABASE_URL"] = "sqlite://"
os.environ.pop("ANTHROPIC_API_KEY", None)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

client = TestClient(app)

SAMPLE_STATE = {
    "workspaces": [
        {
            "id": "ws-1",
            "name": "주간 리포트",
            "type": "output",
            "declaration": {
                "purpose": "리포트 작성",
                "dynamicFields": [
                    {"id": "f1", "label": "대상 독자", "type": "text", "value": "팀"}
                ],
            },
            "content": "# 결과",
            "position": {"x": 80, "y": 80},
            "size": {"width": 320, "height": 220},
        },
        {
            "id": "ws-2",
            "name": "사내 자료",
            "type": "context",
            "declaration": {"purpose": "", "dynamicFields": []},
            "content": "",
            "position": {"x": 460, "y": 120},
            "size": {"width": 320, "height": 220},
            "accessGranted": True,
        },
    ],
    "edges": [
        {"id": "e-1", "source": "ws-1", "target": "ws-2", "type": "source", "hopLimit": 2}
    ],
    "pointer": {"workspaceId": "ws-1", "status": "waiting"},
    "checklistItems": [
        {
            "id": "i-1",
            "workspaceId": "ws-1",
            "title": "초안 작성",
            "tag": "AI",
            "status": "committed",
            "comments": [{"id": "c1", "author": "사용자", "text": "good", "createdAt": "t"}],
            "activityLog": [{"id": "l1", "message": "생성", "createdAt": "t"}],
        },
        {
            "id": "i-2",
            "workspaceId": "ws-1",
            "title": "권한 필요",
            "tag": "permission",
            "status": "pending",
            "assignee": "보드 소유자",
            "relatedWorkspaceId": "ws-2",
            "comments": [],
            "activityLog": [],
        },
    ],
    "snapshots": [
        {
            "id": "s-1",
            "workspaceId": "ws-1",
            "checklistItemId": "i-1",
            "content": "# 결과",
            "createdAt": "2026-06-11T00:00:00Z",
        }
    ],
    "boardLog": [{"id": "bl1", "message": "포인터 이동", "createdAt": "t"}],
}


def test_health():
    assert client.get("/api/health").json() == {"status": "ok"}


def test_board_roundtrip():
    res = client.put("/api/boards/default", json=SAMPLE_STATE)
    assert res.status_code == 200
    assert res.json()["workspaces"] == 2

    exported = client.get("/api/boards/default").json()
    assert {w["id"] for w in exported["workspaces"]} == {"ws-1", "ws-2"}
    ws1 = next(w for w in exported["workspaces"] if w["id"] == "ws-1")
    assert ws1["declaration"]["dynamicFields"][0]["label"] == "대상 독자"
    ws2 = next(w for w in exported["workspaces"] if w["id"] == "ws-2")
    assert ws2["accessGranted"] is True
    assert exported["edges"][0]["hopLimit"] == 2
    assert exported["pointer"]["workspaceId"] == "ws-1"
    # 체크리스트 순서 보존 + 예외 항목 필드 보존
    assert [i["id"] for i in exported["checklistItems"]] == ["i-1", "i-2"]
    assert exported["checklistItems"][1]["relatedWorkspaceId"] == "ws-2"
    assert exported["snapshots"][0]["checklistItemId"] == "i-1"
    assert exported["boardLog"][0]["message"] == "포인터 이동"


def test_reimport_replaces_state():
    client.put("/api/boards/default", json=SAMPLE_STATE)
    smaller = {**SAMPLE_STATE, "workspaces": SAMPLE_STATE["workspaces"][:1], "edges": []}
    client.put("/api/boards/default", json=smaller)
    exported = client.get("/api/boards/default").json()
    assert len(exported["workspaces"]) == 1
    assert exported["edges"] == []


def test_export_missing_board_404():
    assert client.get("/api/boards/nope").status_code == 404


def test_llm_proxy_503_without_key():
    """키가 없으면 503 — 프런트엔드는 스텁 LLM으로 폴백한다."""
    res = client.post(
        "/api/llm/dynamic-fields", json={"name": "a", "type": "output", "purpose": "b"}
    )
    assert res.status_code == 503
    res = client.post(
        "/api/llm/checklist",
        json={"name": "a", "type": "output", "purpose": "b", "dynamicFields": []},
    )
    assert res.status_code == 503
    res = client.post(
        "/api/llm/execute", json={"title": "t", "workspaceName": "w", "purpose": "p"}
    )
    assert res.status_code == 503
