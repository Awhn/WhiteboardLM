import { useBoardStore } from '../board/boardStore'
import { templatesForSource } from './templates'

/**
 * 엣지 드래그 중 정지(또는 빈 캔버스 드롭) 시 나타나는 사전 정의 템플릿 오버레이.
 * - drag 모드: 끌던 엣지를 카드 위에 놓으면 생성 (mouseup은 BoardCanvas의 onConnectEnd가 처리)
 * - click 모드: 카드를 클릭해 생성
 */
export function TemplateMenu({
  x,
  y,
  sourceId,
  mode,
  onSelect,
  onClose,
}: {
  x: number
  y: number
  sourceId: string
  mode: 'drag' | 'click'
  onSelect: (templateId: string) => void
  onClose: () => void
}) {
  const source = useBoardStore((s) => s.workspaces.find((w) => w.id === sourceId))
  if (!source) return null

  const templates = templatesForSource(source)

  return (
    <div
      className="absolute z-40 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-2xl"
      style={{ left: x, top: y }}
      data-testid="template-menu"
    >
      <div className="flex items-center justify-between px-1 pb-1.5">
        <p className="text-[11px] font-semibold text-slate-600">
          {mode === 'drag' ? '여기에 놓아 작업 연결' : '어떤 작업을 연결할까요?'}
        </p>
        <button
          onClick={onClose}
          className="rounded px-1 text-[11px] text-slate-400 hover:bg-slate-100"
          aria-label="템플릿 메뉴 닫기"
        >
          ✕
        </button>
      </div>
      <p className="truncate px-1 pb-1.5 text-[10px] text-slate-400">소스: {source.name}</p>
      <ul className="space-y-1">
        {templates.map((t) => (
          <li key={t.id}>
            <button
              data-template-id={t.id}
              onClick={() => onSelect(t.id)}
              className="flex w-full items-start gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
            >
              <span className="text-base">{t.icon}</span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-slate-700">{t.label}</span>
                <span className="block text-[10px] leading-snug text-slate-400">
                  {t.description}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
