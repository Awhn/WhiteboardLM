# WhiteboardLM Backend (M15)

**프레임워크 결정: FastAPI** — Anthropic Python SDK 연동과 Phase 2 도구 실행(코드 실행 툴)을
같은 런타임에서 다루기 위해 Next.js API Route 대신 FastAPI 채택 (PLAN.md 2장 미결 사항 확정).

## 구성

- `app/models.py` — PostgreSQL 스키마 5종: Board / Workspace / Edge / ChecklistItem / Snapshot
- `app/main.py` — 보드 상태 import(`PUT /api/boards/{id}`, localStorage → DB 이전) / export(`GET`)
- `app/llm.py` — **LiteLLM 기반 멀티 프로바이더** 프록시 (`POST /api/llm/{dynamic-fields,checklist,execute}`)
  - `LLM_MODEL` env로 선택: `anthropic/claude-opus-4-8`(기본) · `openai/gpt-…` · `gemini/gemini-…`
  - 선택된 프로바이더의 키 env(`ANTHROPIC_API_KEY`/`OPENAI_API_KEY`/`GEMINI_API_KEY`) 미설정 시
    503 → 프런트엔드는 스텁 LLM으로 폴백
- `app/tools.py` — 서버 도구 레지스트리 (OpenAI 스타일 function calling, LiteLLM이 전 프로바이더 정규화)
  - 1차 도구: `run_python` (subprocess, 10초 타임아웃 — 운영 배포 시 컨테이너 격리 필요)
  - 새 도구 = `@tool` 데코레이터 함수 추가
  - `/api/llm/execute`가 도구 루프(최대 5회)를 돌고 `toolTrace`를 함께 반환

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
