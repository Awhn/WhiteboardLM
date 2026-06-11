import { useBoardStore } from '../board/boardStore'
import { POINTER_STATUS_CONFIG } from './statusConfig'

/** 포인터가 위치한 작업공간 노드 위에 떠 있는 상태 배지 */
export function PointerBadge({ workspaceId }: { workspaceId: string }) {
  const pointer = useBoardStore((s) => s.pointer)
  if (pointer.workspaceId !== workspaceId) return null

  const cfg = POINTER_STATUS_CONFIG[pointer.status]
  return (
    <div
      className={`absolute -top-9 left-2 z-10 flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1 text-[11px] font-medium text-white shadow-lg ${
        cfg.active ? 'animate-pulse' : ''
      }`}
      data-testid="pointer-badge"
    >
      <span>{cfg.icon}</span>
      <span>{cfg.label}</span>
    </div>
  )
}
