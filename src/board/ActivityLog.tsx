import { useShallow } from 'zustand/react/shallow'
import { useBoardStore } from './boardStore'

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

/** 보드 행동 로그 — 포인터 이동, 항목 실행/승인/반려, 스냅샷 저장·복원 이력 (M8) */
export function ActivityLog() {
  const boardLog = useBoardStore(useShallow((s) => s.boardLog))

  if (boardLog.length === 0) {
    return <p className="p-6 text-center text-sm text-slate-400">아직 기록된 행동이 없습니다.</p>
  }

  return (
    <ul className="divide-y divide-slate-100 p-2">
      {[...boardLog].reverse().map((entry) => (
        <li key={entry.id} className="flex items-baseline gap-3 px-2 py-1.5 text-xs">
          <span className="shrink-0 font-mono text-[10px] text-slate-400">
            {formatTime(entry.createdAt)}
          </span>
          <span className="text-slate-600">{entry.message}</span>
        </li>
      ))}
    </ul>
  )
}
