# WhiteboardLM Backend (M15)

**프레임워크 결정: FastAPI** — Anthropic Python SDK 연동과 Phase 2 도구 실행(코드 실행 툴)을
같은 런타임에서 다루기 위해 Next.js API Route 대신 FastAPI 채택 (PLAN.md 2장 미결 사항 확정).

## 구성

- `app/models.py` — PostgreSQL 스키마 5종: Board / Workspace / Edge / ChecklistItem / Snapshot
- `app/main.py` — 보드 상태 import(`PUT /api/boards/{id}`, localStorage → DB 이전) / export(`GET`)
- `app/llm.py` — Anthropic API 서버사이드 프록시 (`POST /api/llm/{dynamic-fields,checklist,execute}`)
  - 모델: `claude-opus-4-8` (`ANTHROPIC_MODEL`로 변경 가능)
  - `ANTHROPIC_API_KEY` 미설정 시 503 → 프런트엔드는 스텁 LLM으로 폴백

## 실행

```bash
# 로컬 (SQLite 폴백)
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# PostgreSQL 포함 (저장소 루트에서)
docker compose up
```

## 테스트

```bash
cd backend && python -m pytest tests/ -v
```

## 프런트엔드 연동

`VITE_API_BASE=http://localhost:8000`을 설정하면 보드 툴바에 "☁️ 서버 저장" 버튼이 나타난다.
저장 시 localStorage의 보드 상태 전체가 `PUT /api/boards/default`로 이전된다.
