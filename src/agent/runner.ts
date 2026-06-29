import { useBoardStore } from '../board/boardStore'
import { getLLMClient } from '../llm'
import { BlockedError } from '../llm/errors'
import { parseChecklistLines } from '../checklist/parse'
import { matchTool } from './tools'
import { buildSpatialContext } from '../pointer/context'
import { getPersona } from './personas'

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

let running = false
export const isTaskRunning = () => running

/**
 * Task를 실행한다 (v2 §10):
 * 공간 컨텍스트 수집 → 체크리스트 생성 → AI 파생 노드 생성 → [AI] 항목 실행.
 * AI는 항상 새 노드를 만들 뿐 인간 노드를 수정하지 않는다.
 */
export async function runTask(taskId: string): Promise<boolean> {
  const store = useBoardStore
  if (running) return false
  const task = store.getState().tasks.find((t) => t.id === taskId)
  if (!task) return false
  const anchor = store.getState().workspaces.find((w) => w.id === task.anchorNodeId)
  if (!anchor) return false
  const persona = getPersona(
    store.getState().agents.find((a) => a.id === task.agentId)?.persona ?? 'researcher',
  )

  running = true
  const s = () => store.getState()
  s().setAgentStatus(task.agentId, 'working')
  s().updateTask(taskId, { status: 'running' })
  try {
    // 공간 컨텍스트 수집
    const context = buildSpatialContext(task.anchorNodeId, s().workspaces)
    s().updateTask(taskId, { contextNodeIds: context.parts.map((p) => p.workspaceId) })

    // 체크리스트 생성 (미션 기반)
    let lines: string[] = []
    try {
      lines = await getLLMClient().generateChecklist({
        name: task.mission,
        type: 'output',
        purpose: task.mission,
        dynamicFields: [],
      })
    } catch {
      lines = ['[AI] 미션 수행', '[승인] 결과 검토']
    }
    const parsed = parseChecklistLines(lines)
    s().setChecklistForTask(taskId, parsed.length ? parsed : [{ tag: 'AI', title: task.mission }])

    // AI 파생 노드 생성 (인간 노드를 수정하지 않음)
    const output = s().addWorkspace({
      name: `${persona.icon} ${persona.label}: ${task.mission.slice(0, 24)}`,
      kind: 'note',
      author: 'ai',
      derivedFrom: [task.anchorNodeId, ...context.parts.map((p) => p.workspaceId)],
      content: '',
      position: { x: anchor.position.x, y: anchor.position.y + anchor.size.height + 56 },
    })
    s().updateTask(taskId, { outputNodeId: output.id })
    s().logBoard(`${persona.icon} ${persona.label} → 파생 노드 생성: ${output.name}`)

    for (;;) {
      const next = s().checklistItems.find((i) => i.taskId === taskId && i.status === 'pending')
      if (!next) {
        s().updateTask(taskId, { status: 'done' })
        s().setAgentStatus(task.agentId, 'idle')
        s().logBoard(`${persona.icon} ${persona.label} Task 완료`)
        return true
      }
      if (next.tag !== 'AI') {
        s().updateTask(taskId, { status: 'waiting' })
        s().setAgentStatus(task.agentId, 'waiting')
        s().appendItemActivity(next.id, '사용자 행동 대기')
        return true
      }

      let toolResult: string | undefined
      const tool = matchTool(next.title)
      if (tool) {
        s().appendItemActivity(next.id, `도구 사용: ${tool.label}`)
        toolResult = await tool.run(next.title, task.mission)
      }
      await delay(300)

      try {
        const result = await getLLMClient().executeChecklistItem({
          title: next.title,
          workspaceName: output.name,
          purpose: task.mission,
          context: context.text || undefined,
          toolResult,
        })
        const cur = s().workspaces.find((w) => w.id === output.id)
        s().updateWorkspace(output.id, {
          content: cur?.content ? `${cur.content}\n\n${result}` : result,
        })
        s().setChecklistItemStatus(next.id, 'committed')
        s().appendItemActivity(next.id, 'AI 실행 완료')
      } catch (e) {
        if (e instanceof BlockedError) {
          const open = s().checklistItems.some(
            (i) => i.taskId === taskId && i.tag === 'blocking' && i.status !== 'committed',
          )
          if (!open) {
            s().addChecklistItem(output.id, `[자동] 진행 불가: 「${next.title}」`, 'blocking', {
              taskId,
              reason: e.reason,
            })
          }
          s().updateTask(taskId, { status: 'waiting' })
          s().setAgentStatus(task.agentId, 'waiting')
          return true
        }
        s().updateTask(taskId, { status: 'waiting' })
        s().setAgentStatus(task.agentId, 'waiting')
        s().appendItemActivity(next.id, `실행 실패: ${e instanceof Error ? e.message : String(e)}`)
        return false
      }
    }
  } finally {
    running = false
  }
}
