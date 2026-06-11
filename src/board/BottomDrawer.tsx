import { useUIStore, type DrawerTab } from './uiStore'
import { GlobalChecklist } from '../checklist/GlobalChecklist'
import { ActivityLog } from './ActivityLog'

const TABS: { id: DrawerTab; label: string }[] = [
  { id: 'checklist', label: '📋 전체 체크리스트' },
  { id: 'log', label: '🕘 행동 로그' },
]

/** 캔버스·사이드바와 분리된 하단 드로어 — 전체 체크리스트 / 행동 로그 */
export function BottomDrawer() {
  const drawerOpen = useUIStore((s) => s.drawerOpen)
  const drawerTab = useUIStore((s) => s.drawerTab)
  const openDrawer = useUIStore((s) => s.openDrawer)
  const closeDrawer = useUIStore((s) => s.closeDrawer)

  if (!drawerOpen) return null

  return (
    <div className="flex h-72 shrink-0 flex-col border-t border-slate-200 bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.04)] max-md:h-56">
      <header className="flex items-center gap-1 border-b border-slate-100 px-3 py-1.5">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => openDrawer(tab.id)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              drawerTab === tab.id
                ? 'bg-slate-800 text-white'
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <button
          onClick={closeDrawer}
          className="ml-auto rounded px-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="드로어 닫기"
        >
          ✕
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {drawerTab === 'checklist' ? <GlobalChecklist /> : <ActivityLog />}
      </div>
    </div>
  )
}
