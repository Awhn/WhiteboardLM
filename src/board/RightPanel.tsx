import { useEffect } from 'react'
import { useBoardStore } from './boardStore'
import { useUIStore, type RightTab } from './uiStore'
import { GlobalChecklist } from '../checklist/GlobalChecklist'
import { ActivityLog } from './ActivityLog'
import { SettingsPanel } from './SettingsPanel'
import { WorkspaceInspector } from '../workspace/WorkspaceInspector'

const TABS: { id: RightTab; icon: string; label: string }[] = [
  { id: 'inspector', icon: '🧠', label: '정의' },
  { id: 'checklist', icon: '✅', label: '체크리스트' },
  { id: 'log', icon: '🕘', label: '로그' },
  { id: 'settings', icon: '⚙️', label: '설정' },
]

/**
 * 우측 통합 패널 — 세로탭으로 정의/체크리스트/로그/설정을 전환한다.
 * (트리 뷰어는 좌측에 별도 유지)
 */
export function RightPanel() {
  const rightTab = useUIStore((s) => s.rightTab)
  const collapsed = useUIStore((s) => s.rightCollapsed)
  const setRightTab = useUIStore((s) => s.setRightTab)
  const toggleCollapsed = useUIStore((s) => s.toggleRightCollapsed)
  const selectedId = useBoardStore((s) => s.selectedWorkspaceId)

  // 노드를 선택하면 자동으로 정의 탭으로 전환
  useEffect(() => {
    if (selectedId) setRightTab('inspector')
  }, [selectedId, setRightTab])

  return (
    <div className="flex h-full shrink-0">
      {!collapsed && (
        <div className="flex h-full w-80 flex-col border-l border-slate-200 bg-white">
          {rightTab === 'inspector' && <WorkspaceInspector />}
          {rightTab === 'checklist' && (
            <TabFrame title="✅ 전체 체크리스트">
              <GlobalChecklist />
            </TabFrame>
          )}
          {rightTab === 'log' && (
            <TabFrame title="🕘 행동 로그">
              <ActivityLog />
            </TabFrame>
          )}
          {rightTab === 'settings' && <SettingsPanel />}
        </div>
      )}

      {/* 세로 탭 레일 (far right) */}
      <nav
        className="flex h-full w-12 shrink-0 flex-col items-center gap-1 border-l border-slate-200 bg-slate-50 py-2"
        data-testid="right-rail"
      >
        <button
          onClick={toggleCollapsed}
          title={collapsed ? '패널 펼치기' : '패널 접기'}
          aria-label={collapsed ? '패널 펼치기' : '패널 접기'}
          className="mb-1 rounded px-1 py-1 text-xs text-slate-400 hover:bg-slate-200"
        >
          {collapsed ? '◀' : '▶'}
        </button>
        {TABS.map((t) => {
          const active = !collapsed && rightTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setRightTab(t.id)}
              title={t.label}
              aria-label={t.label}
              data-tab={t.id}
              className={`flex w-10 flex-col items-center gap-0.5 rounded-md py-1.5 transition-colors ${
                active
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-500 hover:bg-slate-200'
              }`}
            >
              <span className="text-base leading-none">{t.icon}</span>
              <span className="text-[9px] leading-none">{t.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

function TabFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-slate-200 px-4 py-2.5">
        <h2 className="text-sm font-bold text-slate-800">{title}</h2>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}
