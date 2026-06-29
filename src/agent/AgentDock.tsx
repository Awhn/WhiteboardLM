import { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useBoardStore } from '../board/boardStore'
import { getPersona } from './personas'
import type { AgentStatus } from './types'

const STATUS_RING: Record<AgentStatus, string> = {
  idle: 'ring-slate-200',
  working: 'ring-indigo-400 animate-pulse',
  waiting: 'ring-amber-400',
}

/**
 * 하단 플로팅 Agent Dock (Mac OS 독 스타일, v2 §9).
 * Idle 에이전트를 노드 위로 드래그하면 미션을 시작한다.
 * (추후 사람 협업자도 여기에 표시 가능)
 */
export function AgentDock({
  onAgentDrop,
}: {
  onAgentDrop: (persona: ReturnType<typeof getPersona>['id'], nodeId: string) => void
}) {
  const agents = useBoardStore(useShallow((s) => s.agents))
  const tasks = useBoardStore(useShallow((s) => s.tasks))
  const [drag, setDrag] = useState<{ persona: string; x: number; y: number } | null>(null)
  const dragRef = useRef<typeof drag>(null)
  useEffect(() => {
    dragRef.current = drag
  }, [drag])

  const startDrag = (personaId: string, status: AgentStatus) => (e: React.PointerEvent) => {
    if (status === 'working') return
    e.preventDefault()
    setDrag({ persona: personaId, x: e.clientX, y: e.clientY })

    const move = (ev: PointerEvent) =>
      setDrag((d) => (d ? { ...d, x: ev.clientX, y: ev.clientY } : d))
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      const cur = dragRef.current
      setDrag(null)
      if (!cur) return
      const el = document.elementFromPoint(ev.clientX, ev.clientY)
      const node = el?.closest('.react-flow__node') as HTMLElement | null
      const nodeId = node?.getAttribute('data-id')
      if (nodeId) onAgentDrop(cur.persona as ReturnType<typeof getPersona>['id'], nodeId)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <>
      <div
        className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2"
        data-testid="agent-dock"
      >
        <div className="pointer-events-auto flex items-end gap-2 rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 shadow-lg backdrop-blur">
          {agents.map((a) => {
            const p = getPersona(a.persona)
            const taskCount = tasks.filter(
              (t) => t.agentId === a.id && t.status !== 'done',
            ).length
            return (
              <button
                key={a.id}
                onPointerDown={startDrag(a.persona, a.status)}
                title={`${p.label} — ${p.capability}\n(드래그해서 노드 위에 놓으세요)`}
                data-persona={a.persona}
                className={`relative flex h-11 w-11 cursor-grab touch-none items-center justify-center rounded-xl bg-slate-50 text-xl ring-2 transition-transform hover:-translate-y-1 active:cursor-grabbing ${STATUS_RING[a.status]}`}
              >
                {p.icon}
                {taskCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500 px-1 text-[9px] font-bold text-white">
                    {taskCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {drag && (
        <div
          className="pointer-events-none fixed z-50 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl bg-white text-xl opacity-90 shadow-xl ring-2 ring-indigo-400"
          style={{ left: drag.x, top: drag.y }}
        >
          {getPersona(drag.persona as ReturnType<typeof getPersona>['id']).icon}
        </div>
      )}
    </>
  )
}
