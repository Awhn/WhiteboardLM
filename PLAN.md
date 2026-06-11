# 🪧 WhiteboardLM 구현 계획 (Claude Code 외부 플랜)

> **소스 오브 트루스**: Todoist 프로젝트 `6gmQVw5R4986pwqc`
> https://app.todoist.com/app/project/6gmQVw5R4986pwqc
> 각 작업 단위에 Todoist 태스크 ID를 병기한다. Claude Code 세션에서 작업 완료 시
> Todoist MCP의 `complete-tasks`로 해당 ID를 체크하여 플랜과 실행 상태를 동기화한다.

---

## 0. 제품 개요

WhiteboardLM은 **공간적·선언형 LLM 인터페이스**다. 채팅 스레드 대신:

- **보드(Board)**: 무한 캔버스. 작업의 전체 지형도.
- **작업공간(Workspace)**: 보드 위의 노드 윈도우. `output / context / intermediate` 타입을 가지며, "무엇을 만들 것인가"를 **선언형 정의**(이름/타입/목적 + 동적 필드)로 기술한다.
- **포인터(Pointer)**: AI 에이전트의 현재 위치. 작업공간 위에 떠 있는 배지로 시각화되며 `생각 중 → 계획 중 → 작업 중 → 대기 → 완료` 상태를 가진다.
- **체크리스트(Checklist)**: 선언형 정의로부터 LLM이 자동 생성하는 실행 단계. 각 항목은 `[AI] / [인간] / [승인]` 태그와 `pending → staged → committed` 상태를 가진다.
- **엣지(Edge)**: 작업공간 간 컨텍스트 그래프. `reference / source / update / validate` 타입으로 "포인터가 그 위치에서 무엇을 읽고, 결과를 어디에 쓰는가"를 결정한다.
- **스냅샷(Snapshot)**: committed 시점마다 작업공간 내용을 저장. 임의 시점 되돌리기 지원.

핵심 루프: **선언형 정의 → 체크리스트 자동 생성 → 포인터 이동/실행 → staged(검토) → committed(스냅샷) → 다음 작업공간**.

---

## 1. 핵심 도메인 모델 (전 Phase 공통)

```
Board
 ├─ Workspace { id, name, type: output|context|intermediate,
 │              declaration: { purpose, dynamicFields[] },
 │              content, position, size }
 ├─ Edge { id, source, target,
 │         type: reference|source|update|validate, hopLimit }
 ├─ Pointer { workspaceId, status: thinking|planning|working|
 │            tool_use|waiting|done }
 ├─ ChecklistItem { id, workspaceId, tag: AI|human|approval|blocking|permission,
 │                  status: pending|staged|committed,
 │                  assignee?, comments[], activityLog[] }
 └─ Snapshot { id, workspaceId, checklistItemId, content, createdAt }
```

**엣지 타입 의미론(컨텍스트 로딩 규칙):**

| 타입 | 포인터가 해당 노드에 대해 하는 일 |
|---|---|
| `reference` | 선언형 정의만 컨텍스트에 로드. 필요 시 내용 추가 요청 |
| `source` | 전체 내용 로드 |
| `update` | 작업 결과를 대상 작업공간에 기록 (포인터 자율 이동의 경로이기도 함) |
| `validate` | 결과 검증용 연결 |

`context` 타입 작업공간: 엣지로만 연결 가능하며 포인터 직접 진입은 차단. 접근 시 권한 체크 → 필요하면 `[permission]` 예외 항목 자동 생성.

---

## 2. 기술 스택 결정

| 영역 | Phase 1 | Phase 2+ |
|---|---|---|
| 프론트 | React + TypeScript + Vite, React Flow, Zustand, Tailwind | 동일 |
| LLM | Anthropic API (클라이언트 직접 호출, 프로토타입 한정) | 서버사이드 프록시로 이전 (키 보호) |
| 저장 | localStorage 스냅샷 | PostgreSQL (Board/Workspace/ChecklistItem/Snapshot/Edge) |
| 백엔드 | 없음 | **결정 필요**: FastAPI vs Next.js API Route |
| 실시간 | 없음 | **결정 필요**: Liveblocks vs Yjs / 충돌 처리 OT vs CRDT |
| 배포 | 로컬 | Docker |

**미결 결정 사항 (구현 전 확정 권장):**

1. 백엔드 프레임워크 — Anthropic SDK 스트리밍과 Python 도구 실행(코드 실행 툴)을 고려하면 FastAPI 우세. 단일 레포 단순성은 Next.js 우세.
2. 실시간 동기화 — Yjs(오픈소스, CRDT 내장) vs Liveblocks(관리형, presence 기본 제공). 체크리스트 동시 편집까지 고려하면 Yjs+CRDT로 통일하는 것이 일관적.
3. 인증 — Phase 3 로그인/세션. 자체 구현 vs Auth.js/Clerk.

---

## 3. Phase 1 — 핵심 루프 구현 (단일 사용자, 로컬 저장)

**목표**: 보드 1개에서 "정의 → 체크리스트 → 포인터 실행 → staged/committed → 되돌리기" 루프가 완결되게 한다. 백엔드 없음.

### M1. 프로젝트 초기 셋업 `6gmQW2r2P326rwp6`
- [x] Vite + React + TS 보일러플레이트 `6gmRFCvPwWh8gMrc`
- [x] React Flow / Zustand / Tailwind 설치·설정 `6gmRFF2HC7VMvmP6`
- [x] 폴더 구조: `src/{board,workspace,pointer,checklist,edge}` `6gmRFF5vFr3q6Wqc`

### M2. 보드 캔버스 `6gmQW2wvCW5rrCCc`
- [x] React Flow 보드 렌더링 `6gmRFCvFcw9R5JH6`
- [x] 작업공간 노드 윈도우 (드래그·리사이즈) `6gmRFF426m3JCqqc`
- [x] Zustand 전역 상태: workspaces / edges / pointer `6gmRFF73R5QRmGG6`
- [x] 빈 보드 → 작업공간 추가 UX `6gmRFF988c6F9jgc`

### M3. 작업공간 타입 시스템 `6gmQW34vgCmCFcH6`
- [ ] output / context / intermediate 구분 `6gmRFCr6HHhgF3G6`
- [ ] 타입별 헤더 색상·아이콘 `6gmRFCxCGm627c3c`
- [ ] 타입별 포인터 진입 가능 여부 `6gmRFF5M43xx7wm6`

### M4. 선언형 정의 패널 `6gmQW3734jCF23r6`
- [ ] 고정 필드: 이름/타입/목적 요약 `6gmRFCvxGM3j8mGc`
- [ ] Anthropic API: 목적 입력 → 동적 필드 자동 생성 `6gmRFCwh9C5CQRWc`
- [ ] 동적 필드 렌더링 (text/select/multiline/number) `6gmRFF4GGWH2Gmjc`
- [ ] 정의 완료 상태 표시 `6gmRFF6PCvmmF2X6`

### M5. 체크리스트 자동 생성 `6gmQW385qH3CwW7c`
- [ ] 정의 완료 → API 호출 → 체크리스트 생성 `6gmRFCvP5ccWh636`
- [ ] `[AI]/[인간]/[승인]` 태그 파싱 `6gmRFF58qhH6pCQc`
- [ ] pending → staged → committed 상태 관리 `6gmRFF3mF9fW6jH6`
- [ ] 수동 항목 추가 `6gmRFF8V6PVfr9P6`

### M6. 포인터 컴포넌트 `6gmQW3F3WgX9GpP6`
- [ ] floating badge 시각화 `6gmRFCv97MmgHcq6`
- [ ] 상태별 UI: 🌀📋✏️⏸️✅ `6gmRFCxQ5wrJMMmc`
- [ ] 수동 이동 (클릭/드래그) `6gmRFF52HvWWQ9Q6`
- [ ] 이동 시 체크리스트 실행 트리거 `6gmRFF8CQW5v9v66`

### M7. staged / committed 흐름 `6gmQW3McCRwjh9v6`
- [ ] AI 완료 → staged(노란색) `6gmRFCr3gMxpX3R6`
- [ ] 승인 → committed + 스냅샷 `6gmRFF2H9wVf39V6`
- [ ] 반려 → 코멘트 → AI 재작업 `6gmRFF4GxMmpjQc6`
- [ ] committed 항목 클릭 → 스냅샷 복원 `6gmRFMVJwxG7rCG6`

### M8. 스냅샷·버전 관리 `6gmQW3WF9vqQ4JP6`
- [ ] committed마다 content 스냅샷 (localStorage) `6gmRFMRRcRXfjcj6`
- [ ] 되돌리기: 복원 + 이후 항목 pending 전환 `6gmRFMWpjh59M2xc`
- [ ] 우측 행동 로그 패널 `6gmRFMgxq88CwMPc`

### M9. Phase 1 통합 테스트 `6gmQW3cQ25RF2vPc`
- [ ] 작업공간 2~3개 전체 루프 검증 `6gmRFMW5hpcQXffc`
- [ ] E2E 시나리오: 정의→체크리스트→포인터→staged/committed→되돌리기 `6gmRFMXhH86FQqRc`
- [ ] 엣지케이스: 빈 정의·API 오류·필드 누락 `6gmRFMmHmVfhHpG6`
- [ ] 기본 반응형 정비 `6gmRFMq42vwjM4Rc`

**의존성**: M1 → M2 → M3 → (M4 → M5) → M6 → M7 → M8 → M9.
M3은 M2의 노드 컴포넌트에 종속. M7/M8은 강결합이므로 같은 세션에서 함께 다뤄도 좋다.

---

## 4. Phase 2 — Agent + 컨텍스트 그래프 (지능 계층)

**목표**: 엣지 기반 컨텍스트 로딩, 도구 실행, 예외(블로킹/권한) 자동화, 백엔드 영속화.

### M10. 노드-엣지 컨텍스트 그래프 `6gmQW7h84q7xp2hc`
- [ ] 엣지 타입(reference/source/update/validate) 커스터마이징·시각화 `6gmRFMVjrrQ7PhP6`
- [ ] 포트 드래그 엣지 생성 UI `6gmRFMWg83PG9jM6`
- [ ] 타입별 스타일(선 구분·이모티콘) `6gmRFMhfQ6XmqHJc`
- [ ] hop 제한 설정 UI (1/2단계) `6gmRFMvR282J53Rc`

### M11. 컨텍스트 로딩 로직 `6gmQW7ffWcPcpjRc`
- [ ] 포인터 기준 1-hop 노드의 선언형 정의 자동 로드 `6gmRFMRGPrh888mc`
- [ ] reference: 정의만 로드 + 필요 시 내용 요청 `6gmRFMWxH52274mc`
- [ ] source: 전체 내용 로드 `6gmRFMmcM44PRfjc`
- [ ] context 타입: 엣지로만 연결, 포인터 진입 차단 `6gmRFMvmfCw9HvCc`

### M12. Agent 도구 실행 레이어 `6gmQW7jmJVMXq5H6`
- [ ] 체크리스트 항목 실행 → 툴 호출 연동 `6gmRFMRRrmFg9vx6`
- [ ] 1차 툴: 웹 검색 / 파일 읽기 / 코드 실행 `6gmRFMcWmMrv7qP6`
- [ ] 포인터 tool_use 상태 + 도구 아이콘 `6gmRFMj7fr5vv69c`
- [ ] update 엣지: 결과를 대상 작업공간에 반영 `6gmRFMvmQqh2WRmc`

### M13. [블로킹] 예외 자동 생성 `6gmQW7r5Wv2vHJv6`
- [ ] 판단 불가 상황 감지 `6gmRFMQh95RP9W56`
- [ ] [blocking] 항목 자동 생성 (제목+사유) `6gmRFMcVvX3Vr2Hc`
- [ ] 포인터 waiting 전환 + 알림 `6gmRFMgFhpF2RQV6`
- [ ] 해소 후 AI 재개 `6gmRFMm52QMG4MV6`

### M14. [권한] 예외 자동 생성 `6gmQW7qCPhp44r6c`
- [ ] context 작업공간 접근 권한 체크 `6gmRFMV7mRv5wX56`
- [ ] [permission] 항목 자동 생성 + 담당자 자동 할당 `6gmRFVMQr9fV5qM6`
- [ ] 권한 부여 후 재개 / 엣지 비활성화 선택 UI `6gmRFVWmMXRMjVg6`
- [ ] 예외 항목도 버전 로그에 committed 기록 `6gmRFVfjwpvCcGPc`

### M15. 백엔드 API·DB `6gmQW7rxRhcVR5Rc`
- [ ] FastAPI vs Next.js API Route 결정·설계 `6gmRFVVHXpHPF9j6`
- [ ] PostgreSQL 스키마 5종 `6gmRFVWPh97C9c46`
- [ ] localStorage 스냅샷 → DB 마이그레이션 `6gmRFVgj78rq8q6c`
- [ ] Anthropic API 서버사이드 프록시 (키 보호) `6gmRFVp7GRfmXJ36`

### M16. Phase 2 통합 테스트 `6gmQW83m9PWGXC96`
- [ ] reference/source 컨텍스트 반영 검증 `6gmRFVQ46f9cq8Rc`
- [ ] 도구 호출·결과 처리 확인 `6gmRFVc78jG6W7fc`
- [ ] 블로킹/권한 예외 전체 흐름 `6gmRFVgXxm83mfp6`
- [ ] DB 저장/불러오기 안정성 `6gmRFVmCR2fXjP4c`

**의존성**: M10 → M11 → M12 → (M13, M14 병렬) → M16. M15는 M12 이전 어느 시점이든 가능하나, **도구 실행(코드 실행 툴)은 서버 필요**이므로 실질적으로 M15 → M12 순서를 권장. 즉 M10 → M11 → M15 → M12 → M13/M14 → M16.

---

## 5. Phase 3 — 협업 + 자율화 (멀티 유저)

### M17. 보드 멤버 권한 `6gmQWCxCvrhxqmj6`
- [ ] Owner/Collaborator/Viewer 모델 `6gmRFVQhfJHQjcR6`
- [ ] 로그인·세션 `6gmRFVcvfW32M4Wc`
- [ ] 권한별 포인터 이동 제어 `6gmRFVhF8g4FJ32c`
- [ ] 멤버 초대 UI `6gmRFVmxGG7PqgQc`

### M18. 실시간 협업 동기화 `6gmQWF2gpvC8cxPc`
- [ ] Liveblocks/Yjs 보드 상태 동기화 `6gmRFVPWV6HHwP66`
- [ ] 다중 포인터 표시 (사용자별 색상) `6gmRFVXwfv9R2QP6`
- [ ] 체크리스트 동시 편집 충돌 (OT/CRDT) `6gmRFVgH8MPm4VX6`
- [ ] 진행률·활동 실시간 표시 `6gmRFVp3RqQwM5Jc`

### M19. 체크리스트 담당자 지정 `6gmQWF7mVGw7Pfq6`
- [ ] [인간]/[권한] 항목 담당자 지정 `6gmRFVPXwVWrWvr6`
- [ ] 알림 (in-app + 이메일) `6gmRFVcX5Q5hP9P6`
- [ ] 담당자 완료 → committed 전환 `6gmRFVgcPjHwqfh6`
- [ ] 항목별 활동 이력 `6gmRFVg4v2g2p3h6`

### M20. 포인터 자율 이동 (Option B) `6gmQWFCP366VqJF6`
- [ ] 전체 committed 시 다음 작업공간 자동 판단 `6gmRFVVjMJ7fFrQ6`
- [ ] update 엣지 기준 목적지 선택 `6gmRFVXFPFvJRp3c`
- [ ] 이동 전 사전 승인 화면 `6gmRFXJwCpFvVF2c`
- [ ] 보드별 자율도 On/Off `6gmRFXRX8PXm65w6`

### M21. 코멘트·알림 시스템 `6gmQWFCfFrjfPXxc`
- [ ] 반려 코멘트 UI `6gmRFXH9wc855WH6`
- [ ] 담당자 알림 발송 `6gmRFXRRvRJPCjw6`
- [ ] [블로킹] 해소 요청 알림 `6gmRFXVwC2382xR6`
- [ ] in-app 알림 센터 `6gmRFXcRfRWqXW86`

### M22. Phase 3 통합 테스트·배포 `6gmQWFFFhrjp3w7c`
- [ ] 멀티 유저 E2E `6gmRFXMFhr6qg226`
- [ ] 자율 이동+코멘트+알림 연계 검증 `6gmRFXQP59qvMjHc`
- [ ] Docker 배포 `6gmRFXV3g7GhpMRc`
- [ ] 부하 테스트 `6gmRFXcP3X4WjG4c`

**의존성**: M17 → M18 → (M19, M21 병렬) → M20 → M22. 자율 이동(M20)은 승인·알림 인프라(M19/M21) 위에서 안전하게 동작하므로 마지막에 둔다.

---

## 6. Claude Code 세션 매핑

각 마일스톤(M1~M22)을 1개 세션(또는 큰 것은 2개)으로 본다. 권장 운영 방식:

1. **세션 시작**: 이 PLAN.md를 컨텍스트로 로드 + Todoist MCP `find-tasks(projectId=6gmQVw5R4986pwqc)`로 현재 미완료 상태 확인.
2. **작업**: 해당 마일스톤의 서브태스크 단위로 구현·커밋. 커밋 메시지에 Todoist 태스크 ID 포함 권장 (`feat(pointer): floating badge [6gmRFCv97MmgHcq6]`).
3. **세션 종료**: 완료한 서브태스크를 `complete-tasks([ids])`로 일괄 체크. 막힌 항목은 코멘트로 사유 기록 — WhiteboardLM 자체의 [blocking] 철학을 플랜 운영에도 동일하게 적용.

**세션 분할 제안 (Phase 1 기준):**

- 세션 1: M1+M2 (셋업+캔버스) — 보일러플레이트라 한 번에 가능
- 세션 2: M3+M4 (타입+정의 패널)
- 세션 3: M5+M6 (체크리스트 생성+포인터) — 핵심 루프의 심장
- 세션 4: M7+M8 (staged/committed+스냅샷) — 상태 머신 강결합
- 세션 5: M9 (통합 테스트·정비)

---

## 7. 리스크 및 선제 대응

- **LLM 구조화 출력 신뢰성** (M4 동적 필드, M5 체크리스트 생성): JSON 스키마 강제 + 파싱 실패 시 재시도 1회 + 수동 폴백 UI를 처음부터 설계.
- **포인터 상태 머신 복잡도**: thinking/planning/working/tool_use/waiting/done + 예외 전이를 명시적 FSM(XState 또는 단순 reducer)으로 구현. 암묵적 boolean 조합 금지.
- **스냅샷 되돌리기 의미론**: "복원 + 이후 항목 pending 전환"은 그래프상 downstream 작업공간에도 영향. Phase 1에서는 단일 작업공간 범위로 한정하고, 그래프 전파는 Phase 2에서 결정.
- **API 키 노출**: Phase 1 클라이언트 직접 호출은 로컬 프로토타입 한정. 공개 배포 전 M15(서버 프록시) 필수.
- **컨텍스트 폭발**: source 엣지 다수 연결 시 토큰 초과. hop 제한(M10)과 함께 토큰 예산 기반 truncation 정책 필요.
