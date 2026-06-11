# 🪧 WhiteboardLM

**공간적·선언형 LLM 인터페이스.** 채팅 스레드 대신 무한 캔버스 보드 위에서 작업공간을
선언형으로 정의하면, AI 포인터가 자동 생성된 체크리스트를 따라 이동하며 실행한다.

## 핵심 개념

- **보드(Board)** — 무한 캔버스. 작업의 전체 지형도.
- **작업공간(Workspace)** — 보드 위의 노드 윈도우. `output / context / intermediate` 타입과 선언형 정의(목적 + 동적 필드)를 가진다.
- **포인터(Pointer)** — AI 에이전트의 현재 위치. `thinking → planning → working → waiting → done` 상태 배지.
- **체크리스트(Checklist)** — 선언형 정의로부터 LLM이 자동 생성하는 실행 단계. `[AI]/[인간]/[승인]` 태그, `pending → staged → committed` 상태.
- **엣지(Edge)** — 작업공간 간 컨텍스트 그래프 (`reference / source / update / validate`).
- **스냅샷(Snapshot)** — committed 시점마다 저장되는 작업공간 내용. 임의 시점 되돌리기.

핵심 루프: **선언형 정의 → 체크리스트 자동 생성 → 포인터 이동/실행 → staged(검토) → committed(스냅샷) → 다음 작업공간**

전체 로드맵은 [PLAN.md](./PLAN.md) 참고.

## 기술 스택

React 19 + TypeScript + Vite · [@xyflow/react](https://reactflow.dev) (React Flow 12) · Zustand · Tailwind CSS 4

## 시작하기

```bash
npm install
npm run dev    # http://localhost:5173
npm run build  # 타입 체크 + 프로덕션 빌드
npm run lint
```

## 폴더 구조

```
src/
├── board/      # 보드 캔버스, 전역 상태(Zustand), 스냅샷 타입
├── workspace/  # 작업공간 노드 윈도우, 선언형 정의 타입
├── pointer/    # AI 포인터 상태 머신 타입
├── checklist/  # 체크리스트 항목 타입
└── edge/       # 컨텍스트 그래프 엣지 타입
```
