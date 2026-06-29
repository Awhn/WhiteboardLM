import { useShallow } from 'zustand/react/shallow'
import { useBoardStore } from '../board/boardStore'
import { getPersona } from '../agent/personas'
import type { TaskStatus } from '../agent/types'
import { ChecklistItemRow } from './ChecklistItemRow'

const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  proposed: '준비',
  running: '실행 중',
  waiting: '대기',
  done: '완료',
}

/** 보드 전체 Task의 체크리스트를 에이전트별로 모아 보는 뷰 (v2) */
export function GlobalChecklist() {
  const tasks = useBoardStore(useShallow((s) => s.tasks))
  const items = useBoardStore(useShallow((s) => s.checklistItems))
  const agents = useBoardStore(useShallow((s) => s.agents))

  if (tasks.length === 0) {
    return (
      <p className="p-6 text-center text-sm text-slate-400">
        아직 실행한 작업이 없습니다. 하단 독에서 에이전트를 노드 위로 끌어다 놓으세요.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
      {[...tasks].reverse().map((task) => {
        const persona = getPersona(
          agents.find((a) => a.id === task.agentId)?.persona ?? 'researcher',
        )
        const taskItems = items.filter((i) => i.taskId === task.id)
        const committed = taskItems.filter((i) => i.status === 'committed').length
        return (
          <section key={task.id} className="rounded-lg border border-slate-200">
            <header className="flex items-center gap-1.5 rounded-t-lg border-b border-indigo-100 bg-indigo-50 px-3 py-2">
              <span>{persona.icon}</span>
              <span className="truncate text-xs font-semibold text-slate-800">
                {task.mission}
              </span>
              <span className="ml-auto shrink-0 rounded bg-white px-1.5 py-0.5 text-[10px] text-slate-500">
                {TASK_STATUS_LABEL[task.status]} · {committed}/{taskItems.length}
              </span>
            </header>
            <ul className="space-y-1 p-2">
              {taskItems.map((item) => (
                <ChecklistItemRow key={item.id} item={item} />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
