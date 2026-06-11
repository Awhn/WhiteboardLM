import { useBoardStore } from '../board/boardStore'
import { getLLMClient } from '../llm'
import { BlockedError } from '../llm/errors'
import { matchTool } from '../agent/tools'
import { buildPointerContext } from './context'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

let running = false

export const isPointerRunning = () => running

/**
 * 포인터를 작업공간으로 이동시키고 체크리스트 실행을 트리거한다 (M6/M11/M12/M13/M14).
 *
 * 상태 머신: thinking → planning → (tool_use? → working → staged)* → waiting | done
 * - 실행 전 엣지 그래프에서 컨텍스트 수집 (reference: 정의만 / source: 전체 내용)
 * - context 타입 접근 권한이 없으면 [permission] 항목 자동 생성 후 waiting
 * - [AI] 항목: 제목과 매칭되는 도구가 있으면 tool_use로 먼저 실행
 * - 판단 불가(BlockedError) 시 [blocking] 항목 자동 생성 후 waiting
 * - [인간]/[승인] 등 그 외 태그: waiting으로 멈추고 사용자 행동을 기다린다
 */
export async function runPointerAt(workspaceId: string): Promise<boolean> {
  const store = useBoardStore
  if (running) return false
  if (!store.getState().movePointer(workspaceId)) return false

  running = true
  const setStatus = store.getState().setPointerStatus
  const wsName = store.getState().workspaces.find((w) => w.id === workspaceId)?.name ?? workspaceId
  store.getState().logBoard(`포인터 이동: ${wsName}`)
  try {
    setStatus('thinking')
    await delay(500)
    setStatus('planning')
    await delay(500)

    // M11: 포인터 기준 컨텍스트 수집 (M14: 권한 체크 포함)
    const { workspaces, edges } = store.getState()
    const context = buildPointerContext(workspaceId, workspaces, edges)

    if (context.permissionNeeded.length > 0) {
      const items = store.getState().checklistItems
      for (const need of context.permissionNeeded) {
        const alreadyOpen = items.some(
          (i) =>
            i.workspaceId === workspaceId &&
            i.tag === 'permission' &&
            i.relatedWorkspaceId === need.workspaceId &&
            i.status !== 'committed',
        )
        if (alreadyOpen) continue
        store.getState().addChecklistItem(
          workspaceId,
          `「${need.name}」 컨텍스트 접근 권한 필요`,
          'permission',
          {
            relatedWorkspaceId: need.workspaceId,
            assignee: '보드 소유자',
            reason: `context 타입 작업공간 「${need.name}」에 연결된 엣지가 있지만 읽기 권한이 없습니다. 권한을 부여하거나 엣지를 비활성화하세요.`,
          },
        )
        store.getState().logBoard(`[권한] 예외 생성: 「${need.name}」 접근 필요 (${wsName})`)
      }
      setStatus('waiting')
      return true
    }

    for (;;) {
      const next = store
        .getState()
        .checklistItems.find((i) => i.workspaceId === workspaceId && i.status === 'pending')

      if (!next) {
        setStatus('done')
        store.getState().logBoard(`체크리스트 처리 완료: ${wsName}`)
        return true
      }

      if (next.tag !== 'AI') {
        setStatus('waiting')
        store.getState().appendItemActivity(next.id, '사용자 행동 대기 — 포인터 일시정지')
        store.getState().logBoard(`대기: 「${next.title}」 사용자 행동 필요`)
        return true
      }

      const ws = store.getState().workspaces.find((w) => w.id === workspaceId)
      if (!ws) return false

      // M12: 도구 매칭 시 tool_use 상태로 먼저 실행
      let toolResult: string | undefined
      const tool = matchTool(next.title)
      if (tool) {
        setStatus('tool_use', tool.id)
        store.getState().appendItemActivity(next.id, `도구 사용: ${tool.label}`)
        toolResult = await tool.run(next.title, ws.declaration.purpose)
      }

      setStatus('working')

      // M13: 같은 작업공간에 committed된 [blocking] 항목이 있으면 해소된 것으로 본다
      const blockResolved = store
        .getState()
        .checklistItems.some(
          (i) => i.workspaceId === workspaceId && i.tag === 'blocking' && i.status === 'committed',
        )

      try {
        const result = await getLLMClient().executeChecklistItem({
          title: next.title,
          workspaceName: ws.name,
          purpose: ws.declaration.purpose,
          comment: next.comments.at(-1)?.text,
          context: context.text || undefined,
          toolResult,
          blockResolved,
        })
        store.getState().updateWorkspace(workspaceId, {
          content: ws.content ? `${ws.content}\n\n${result}` : result,
        })
        store.getState().setChecklistItemStatus(next.id, 'staged')
        store.getState().appendItemActivity(next.id, 'AI 실행 완료 — 검토 대기(staged)')
        store.getState().logBoard(`AI 실행: 「${next.title}」 → staged`)
      } catch (e) {
        if (e instanceof BlockedError) {
          // M13: [blocking] 예외 항목 자동 생성 (제목 + 막힌 이유), 중복 생성 방지
          const alreadyOpen = store
            .getState()
            .checklistItems.some(
              (i) =>
                i.workspaceId === workspaceId &&
                i.tag === 'blocking' &&
                i.status !== 'committed',
            )
          if (!alreadyOpen) {
            store.getState().addChecklistItem(
              workspaceId,
              `[자동] 진행 불가: 「${next.title}」`,
              'blocking',
              { reason: e.reason },
            )
            store.getState().logBoard(`[블로킹] 예외 생성: 「${next.title}」 — ${e.reason}`)
          }
          store.getState().appendItemActivity(next.id, `블로킹: ${e.reason}`)
          setStatus('waiting')
          return true
        }
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
