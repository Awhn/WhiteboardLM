import { useShallow } from 'zustand/react/shallow'
import { useBoardStore } from '../board/boardStore'
import { kindOf } from './kinds/registry'
import { AUTHOR_CONFIG, authorOf } from './authorConfig'
import { getPersona } from '../agent/personas'
import type { TaskStatus } from '../agent/types'
import { ChecklistItemRow } from '../checklist/ChecklistItemRow'

const TASK_STATUS: Record<TaskStatus, { label: string; cls: string }> = {
  proposed: { label: '준비', cls: 'bg-slate-100 text-slate-500' },
  running: { label: '실행 중', cls: 'bg-indigo-100 text-indigo-700' },
  waiting: { label: '대기', cls: 'bg-amber-100 text-amber-700' },
  done: { label: '완료', cls: 'bg-emerald-100 text-emerald-700' },
}

/**
 * 우측 패널 "정의" 탭 (v2): 선택된 노드의 메타 + 이 노드와 얽힌 Task들.
 * 선언형 정의는 제거됨 — 모든 노드는 Post-it이고 의도는 Task(미션)에 담긴다.
 */
export function WorkspaceInspector() {
  const workspace = useBoardStore((s) =>
    s.workspaces.find((w) => w.id === s.selectedWorkspaceId),
  )
  const updateWorkspace = useBoardStore((s) => s.updateWorkspace)
  const selectedId = useBoardStore((s) => s.selectedWorkspaceId)
  const tasks = useBoardStore(
    useShallow((s) =>
      s.tasks.filter(
        (t) => t.anchorNodeId === selectedId || t.outputNodeId === selectedId,
      ),
    ),
  )
  const items = useBoardStore(useShallow((s) => s.checklistItems))
  const agents = useBoardStore(useShallow((s) => s.agents))

  if (!workspace) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-xs leading-relaxed text-slate-400">
        캔버스나 탐색기에서 노드를 선택하면
        <br />
        노드 정보와 작업이 여기 표시됩니다.
      </div>
    )
  }

  const kind = kindOf(workspace)
  const author = AUTHOR_CONFIG[authorOf(workspace.author)]

  return (
    <aside className="flex h-full w-full flex-col bg-white">
      <header className="flex items-center gap-2 border-b border-slate-200 px-4 py-2.5">
        <h2 className="text-sm font-bold text-slate-800">
          {kind.icon} {kind.label}
        </h2>
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${author.chipClass}`}>
          {author.icon} {author.label}
        </span>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">이름</span>
          <input
            value={workspace.name}
            onChange={(e) => updateWorkspace(workspace.id, { name: e.target.value })}
            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
          />
        </label>

        <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] leading-snug text-slate-500">
          {kind.description}
          <br />
          <span className="text-slate-400">
            가까이 둔 노드는 에이전트 실행 시 컨텍스트로 함께 읽힙니다. 하단 독의 에이전트를
            이 노드 위로 끌어다 놓아 작업을 시작하세요.
          </span>
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-semibold text-slate-600">
            이 노드의 작업
          </span>
          {tasks.length === 0 ? (
            <p className="rounded-md border border-dashed border-slate-200 px-3 py-3 text-center text-[11px] text-slate-400">
              아직 작업이 없습니다.
            </p>
          ) : (
            <div className="space-y-3">
              {[...tasks].reverse().map((task) => {
                const persona = getPersona(
                  agents.find((a) => a.id === task.agentId)?.persona ?? 'researcher',
                )
                const st = TASK_STATUS[task.status]
                const taskItems = items.filter((i) => i.taskId === task.id)
                return (
                  <div key={task.id} className="rounded-lg border border-slate-200">
                    <div className="flex items-center gap-1.5 border-b border-slate-100 px-2 py-1.5">
                      <span>{persona.icon}</span>
                      <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-700">
                        {task.mission}
                      </span>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold ${st.cls}`}>
                        {st.label}
                      </span>
                    </div>
                    {taskItems.length > 0 && (
                      <ul className="space-y-1 p-2">
                        {taskItems.map((item) => (
                          <ChecklistItemRow key={item.id} item={item} />
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
