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

## Cloud Run 배포

프런트는 Cloudflare Pages(정적), 백엔드는 Google Cloud Run에 배포한다.

```bash
cd backend
PROJECT=<gcp-project-id> CORS_ORIGINS=https://<your>.pages.dev ./deploy.sh
```

배포가 끝나면 출력된 Service URL을 **Cloudflare Pages 빌드 환경변수 `VITE_API_BASE`** 에 넣고 재배포한다.

### 환경변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `PORT` | 8080 | Cloud Run이 주입. 컨테이너는 `0.0.0.0:$PORT`로 리슨. |
| `CORS_ALLOW_ORIGINS` | `http://localhost:5173` | 콤마 구분 허용 오리진. **Cloudflare Pages 도메인**을 지정. |
| `CORS_ALLOW_ORIGIN_REGEX` | `https://.*\.pages\.dev` | 와일드카드 오리진(프리뷰 배포 등). |
| `DATABASE_URL` | (미설정→SQLite) | 보드 영속화용 Postgres. **Cloud Run에서 미설정 시 비내구성**(재시작 시 소실). 영속화하려면 무료 Neon/Supabase URL 지정. |
| `ENABLE_RUN_PYTHON` | `false` | 코드 실행 도구. **공개 엔드포인트라 기본 비활성**(임의 코드 실행=RCE 위험). 신뢰 환경에서만 켠다. |
| `LLM_MODEL` | `anthropic/claude-opus-4-8` | LiteLLM 모델 문자열(선택). |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY` | — | 서버측 키(선택). 제로-시크릿 모드면 불필요. |
| `MAX_TOOL_ITERATIONS` / `MAX_BODY_BYTES` | `5` / `10MB` | 한도. |

전체 목록은 `.env.example` 참고.

### 제로-시크릿 모드 (권장)

서버에 프로바이더 키를 두지 않아도 된다. 프런트엔드 설정 패널에서 사용자가 입력한 키가
요청마다 `X-LLM-Model` / `X-LLM-Api-Key` 헤더로 전달되어 LiteLLM에 그대로 주입된다.
따라서 키 없이 배포해도 LLM 기능이 동작하며, 서버는 비밀을 보관하지 않는다.

### 데이터베이스 (영속화 트레이드오프)

LLM 프록시 엔드포인트(`mission`/`dynamic-fields`/`checklist`/`execute`)는 **DB를 전혀 쓰지 않는다.**
보드 import/export(`PUT/GET /api/boards/{id}`)만 상태를 쓰며, 이는 프런트 localStorage 위의 **선택적 동기화**다.
- 기본: `DATABASE_URL` 미설정 → SQLite 폴백(Cloud Run에선 비내구성, 부팅 시 경고 로그).
- 영속화: `DATABASE_URL`에 무료 관리형 Postgres(Neon/Supabase) 지정.

### 보안 메모

- `/api/llm/execute`는 무인증 공개 엔드포인트다. `run_python`은 기본 비활성이라 기본 배포엔 RCE 표면이 없다.
- 활성화 시에도 자식 프로세스 환경에서 `*_API_KEY`/`DATABASE_URL`을 제거하고 코드 길이를 제한한다.
- 본문 크기 상한(`MAX_BODY_BYTES`, 기본 10MB)으로 대용량 페이로드를 413으로 거절한다.
- 전면 인증이 필요하면 `deploy.sh`의 `--allow-unauthenticated`를 제거하고 IAP/프록시 인증을 둔다.
