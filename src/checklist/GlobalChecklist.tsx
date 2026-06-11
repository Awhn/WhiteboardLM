import { useShallow } from 'zustand/react/shallow'
import { useBoardStore } from '../board/boardStore'
import { WORKSPACE_TYPE_CONFIG } from '../workspace/typeConfig'
import { ChecklistItemRow } from './ChecklistItemRow'

/** 보드 전체 작업공간의 체크리스트를 한 곳에서 보는 뷰 (하단 드로어) */
export function GlobalChecklist() {
  const workspaces = useBoardStore((s) => s.workspaces)
  const items = useBoardStore(useShallow((s) => s.checklistItems))
  const selectWorkspace = useBoardStore((s) => s.selectWorkspace)

  const groups = workspaces
    .map((ws) => ({ ws, items: items.filter((i) => i.workspaceId === ws.id) }))
    .filter((g) => g.items.length > 0)

  if (groups.length === 0) {
    return (
      <p className="p-6 text-center text-sm text-slate-400">
        아직 체크리스트가 없습니다. 작업공간의 정의를 완료하고 체크리스트를 생성하세요.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
      {groups.map(({ ws, items: wsItems }) => {
        const cfg = WORKSPACE_TYPE_CONFIG[ws.type]
        const committed = wsItems.filter((i) => i.status === 'committed').length
        return (
          <section key={ws.id} className="rounded-lg border border-slate-200">
            <button
              onClick={() => selectWorkspace(ws.id)}
              title="클릭하면 해당 작업공간을 선택합니다"
              className={`flex w-full items-center gap-1.5 rounded-t-lg border-b px-3 py-2 text-left ${cfg.headerClass}`}
            >
              <span>{cfg.icon}</span>
              <span className="truncate text-xs font-semibold text-slate-800">{ws.name}</span>
              <span className="ml-auto shrink-0 text-[10px] text-slate-500">
                {committed}/{wsItems.length} committed
              </span>
            </button>
            <ul className="space-y-1 p-2">
              {wsItems.map((item) => (
                <ChecklistItemRow key={item.id} item={item} />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
