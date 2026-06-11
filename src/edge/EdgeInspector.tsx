import { useBoardStore } from '../board/boardStore'
import { EDGE_TYPES, EDGE_TYPE_CONFIG } from './edgeConfig'

/** 선택된 엣지의 타입·hop 제한·활성화를 편집하는 플로팅 인스펙터 (M10) */
export function EdgeInspector({
  edgeId,
  onClose,
}: {
  edgeId: string
  onClose: () => void
}) {
  const edge = useBoardStore((s) => s.edges.find((e) => e.id === edgeId))
  const workspaces = useBoardStore((s) => s.workspaces)
  const updateEdge = useBoardStore((s) => s.updateEdge)
  const removeEdge = useBoardStore((s) => s.removeEdge)

  if (!edge) return null

  const sourceName = workspaces.find((w) => w.id === edge.source)?.name ?? '?'
  const targetName = workspaces.find((w) => w.id === edge.target)?.name ?? '?'
  const cfg = EDGE_TYPE_CONFIG[edge.type]

  return (
    <div className="absolute bottom-4 left-1/2 z-20 w-96 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
      <div className="mb-2 flex items-center justify-between">
        <span className="truncate text-xs font-semibold text-slate-700">
          {sourceName} <span className="text-slate-400">→</span> {targetName}
        </span>
        <button
          onClick={onClose}
          className="rounded px-1 text-slate-400 hover:bg-slate-100"
          aria-label="인스펙터 닫기"
        >
          ✕
        </button>
      </div>

      <div className="grid grid-cols-4 gap-1">
        {EDGE_TYPES.map((type) => {
          const c = EDGE_TYPE_CONFIG[type]
          const active = edge.type === type
          return (
            <button
              key={type}
              onClick={() => updateEdge(edge.id, { type })}
              title={c.description}
              className={`rounded-md border px-1 py-1.5 text-[11px] font-medium transition-colors ${
                active
                  ? 'border-slate-400 bg-slate-800 text-white'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              {c.icon} {c.label}
            </button>
          )
        })}
      </div>
      <p className="mt-1 text-[10px] leading-snug text-slate-400">{cfg.description}</p>

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-slate-500">hop 제한</span>
          {([1, 2] as const).map((hop) => (
            <button
              key={hop}
              onClick={() => updateEdge(edge.id, { hopLimit: hop })}
              className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                edge.hopLimit === hop
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {hop}단계
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => updateEdge(edge.id, { disabled: !edge.disabled })}
            className={`rounded px-2 py-0.5 text-[11px] font-medium ${
              edge.disabled
                ? 'bg-orange-100 text-orange-600'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            {edge.disabled ? '비활성화됨' : '활성'}
          </button>
          <button
            onClick={() => {
              removeEdge(edge.id)
              onClose()
            }}
            className="rounded bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600 hover:bg-red-100"
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  )
}
