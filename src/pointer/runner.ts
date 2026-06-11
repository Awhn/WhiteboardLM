import { useBoardStore } from '../board/boardStore'
import { getLLMClient } from '../llm'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

let running = false

export const isPointerRunning = () => running

/**
 * 포인터를 작업공간으로 이동시키고 체크리스트 실행을 트리거한다 (M6).
 *
 * 상태 머신: thinking → planning → (working → staged)* → waiting | done
 * - [AI] 항목: 스텁 LLM으로 실행, 결과를 작업공간 content에 누적, staged로 전환
 * - [인간]/[승인] 등 그 외 태그: waiting으로 멈추고 사용자 행동을 기다린다
 *
 * 진입 불가(context 타입)이거나 이미 실행 중이면 false를 반환한다.
 */
export async function runPointerAt(workspaceId: string): Promise<boolean> {
  const store = useBoardStore
  if (running) return false
  if (!store.getState().movePointer(workspaceId)) return false

  running = true
  const setStatus = store.getState().setPointerStatus
  try {
    setStatus('thinking')
    await delay(500)
    setStatus('planning')
    await delay(500)

    for (;;) {
      const next = store
        .getState()
        .checklistItems.find((i) => i.workspaceId === workspaceId && i.status === 'pending')

      if (!next) {
        setStatus('done')
        return true
      }

      if (next.tag !== 'AI') {
        setStatus('waiting')
        store.getState().appendItemActivity(next.id, '사용자 행동 대기 — 포인터 일시정지')
        return true
      }

      setStatus('working')
      const ws = store.getState().workspaces.find((w) => w.id === workspaceId)
      if (!ws) return false

      try {
        const result = await getLLMClient().executeChecklistItem({
          title: next.title,
          workspaceName: ws.name,
          purpose: ws.declaration.purpose,
        })
        store.getState().updateWorkspace(workspaceId, {
          content: ws.content ? `${ws.content}\n\n${result}` : result,
        })
        store.getState().setChecklistItemStatus(next.id, 'staged')
        store.getState().appendItemActivity(next.id, 'AI 실행 완료 — 검토 대기(staged)')
      } catch (e) {
        setStatus('waiting')
        store
          .getState()
          .appendItemActivity(
            next.id,
            `실행 실패: ${e instanceof Error ? e.message : String(e)}`,
          )
        return false
      }
    }
  } finally {
    running = false
  }
}
