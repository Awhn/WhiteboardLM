import { useEffect, useRef, useState } from 'react'
import { getPersona } from './personas'
import { getLLMClient } from '../llm'
import type { AgentPersona } from './types'

/**
 * 캔버스 미션 말풍선 (v2 §5,6): 드롭하면 AI가 미션을 제안하고,
 * 사용자가 교정한다. "빈 입력창" 대신 교정으로 시작한다.
 */
export function MissionBubble({
  persona,
  anchorName,
  anchorContent,
  context,
  x,
  y,
  onConfirm,
  onCancel,
}: {
  persona: AgentPersona
  anchorName: string
  anchorContent: string
  context: string
  x: number
  y: number
  onConfirm: (mission: string) => void
  onCancel: () => void
}) {
  const p = getPersona(persona)
  const fallback = p.missionHint(anchorName)
  const [mission, setMission] = useState(fallback)
  const [proposing, setProposing] = useState(true)
  const editedRef = useRef(false)

  // 마운트 시 AI 미션 제안 → 사용자가 아직 손대지 않았으면 교체
  useEffect(() => {
    let alive = true
    getLLMClient()
      .proposeMission({ capability: p.capability, anchorName, anchorContent, context, fallback })
      .then((proposed) => {
        if (alive && !editedRef.current && proposed.trim()) setMission(proposed.trim())
      })
      .catch(() => {})
      .finally(() => alive && setProposing(false))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="absolute z-40 w-72 -translate-x-1/2 -translate-y-full"
      style={{ left: x, top: y - 12 }}
      data-testid="mission-bubble"
    >
      <div className="rounded-xl border border-indigo-200 bg-white p-3 shadow-2xl">
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <span className="text-base">{p.icon}</span>
          {p.label}
          <span className="ml-auto text-[10px] font-normal text-slate-400">
            {proposing ? '✨ 제안 중…' : '미션 교정'}
          </span>
        </div>
        <p className="mb-1.5 text-[11px] leading-snug text-slate-500">
          이렇게 진행할게요. 필요하면 고쳐 주세요:
        </p>
        <textarea
          autoFocus
          value={mission}
          onChange={(e) => {
            editedRef.current = true
            setMission(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && mission.trim()) {
              onConfirm(mission.trim())
            } else if (e.key === 'Escape') onCancel()
          }}
          rows={2}
          className="w-full resize-none rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:border-indigo-400 focus:outline-none"
          data-testid="mission-input"
        />
        <div className="mt-2 flex items-center justify-end gap-1.5">
          <button
            onClick={onCancel}
            className="rounded px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-100"
          >
            취소
          </button>
          <button
            onClick={() => mission.trim() && onConfirm(mission.trim())}
            disabled={!mission.trim()}
            className="rounded-md bg-indigo-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-indigo-700 disabled:bg-slate-300"
          >
            ▶ 실행
          </button>
        </div>
      </div>
      <div className="absolute left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-indigo-200 bg-white" />
    </div>
  )
}
