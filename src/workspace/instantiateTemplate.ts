import { useBoardStore } from '../board/boardStore'
import { getLLMClient } from '../llm'
import { parseChecklistLines } from '../checklist/parse'
import { runPointerAt } from '../pointer/runner'
import { WORKSPACE_TEMPLATES } from './templates'

/**
 * 템플릿으로 작업공간을 생성하고 즉시 작업을 시작한다:
 * 생성 → 소스와 엣지 연결 → 체크리스트 자동 생성 → 포인터 실행.
 */
export async function instantiateTemplate(
  sourceId: string,
  templateId: string,
  position: { x: number; y: number },
): Promise<string | null> {
  const store = useBoardStore.getState()
  const source = store.workspaces.find((w) => w.id === sourceId)
  const template = WORKSPACE_TEMPLATES.find((t) => t.id === templateId)
  if (!source || !template) return null

  // 템플릿(요약/비판/…)은 AI 산출물 → 생성자 ai + 원본에서 파생
  const workspace = store.addWorkspace({
    ...template.build(source),
    position,
    author: 'ai',
    derivedFrom: [sourceId],
  })
  store.addEdge(sourceId, workspace.id, template.edgeType)
  store.selectWorkspace(workspace.id)
  store.logBoard(`템플릿 생성: ${template.icon} ${template.label} ← ${source.name}`)

  try {
    const lines = await getLLMClient().generateChecklist({
      name: workspace.name,
      type: workspace.type,
      purpose: workspace.declaration.purpose,
      dynamicFields: workspace.declaration.dynamicFields,
    })
    const parsed = parseChecklistLines(lines)
    if (parsed.length > 0) {
      store.setChecklistForWorkspace(workspace.id, parsed)
      void runPointerAt(workspace.id)
    }
  } catch (e) {
    store.logBoard(
      `템플릿 체크리스트 생성 실패: ${e instanceof Error ? e.message : String(e)} — 사이드바에서 수동 생성하세요.`,
    )
  }
  return workspace.id
}
