import { useMemo, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useBoardStore } from './boardStore'
import { useUIStore } from './uiStore'
import { NODE_KINDS, resolveKind } from '../workspace/kinds/registry'
import { AUTHOR_CONFIG, authorOf } from '../workspace/authorConfig'
import type { NodeKind } from '../workspace/types'

/**
 * 좌측 파일트리 뷰어 — 보드의 모든 노드를 카인드별로 묶어 트리로 표시.
 * 행 클릭 시 해당 노드를 선택하고 캔버스 중앙으로 이동(setCenter).
 */
export function BoardExplorer() {
  const open = useUIStore((s) => s.explorerOpen)
  const toggle = useUIStore((s) => s.toggleExplorer)

  // 원본 배열을 선택해 useMemo로 가공 (셀렉터에서 새 객체 생성 시 무한 리렌더 방지)
  const workspaces = useBoardStore((s) => s.workspaces)
  const selectedId = useBoardStore((s) => s.selectedWorkspaceId)
  const pointerId = useBoardStore((s) => s.pointer.workspaceId)
  const selectWorkspace = useBoardStore((s) => s.selectWorkspace)
  const { setCenter } = useReactFlow()

  const [collapsed, setCollapsed] = useState<Set<NodeKind>>(new Set())

  const groups = useMemo(
    () =>
      NODE_KINDS.map((k) => ({
        kind: k,
        nodes: workspaces.filter((w) => resolveKind(w) === k.id),
      })).filter((g) => g.nodes.length > 0),
    [workspaces],
  )

  const focus = (id: string) => {
    selectWorkspace(id)
    const w = workspaces.find((x) => x.id === id)
    if (w) {
      setCenter(w.position.x + w.size.width / 2, w.position.y + w.size.height / 2, {
        zoom: 1,
        duration: 400,
      })
    }
  }

  const toggleGroup = (kind: NodeKind) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })

  if (!open) {
    return (
      <button
        onClick={toggle}
        title="탐색기 열기"
        aria-label="탐색기 열기"
        className="absolute left-0 top-1/2 z-20 -translate-y-1/2 rounded-r-md border border-l-0 border-slate-200 bg-white px-1 py-3 text-xs text-slate-400 shadow-sm hover:bg-slate-100"
      >
        ▶
      </button>
    )
  }

  return (
    <nav className="flex h-full w-56 shrink-0 flex-col border-r border-slate-200 bg-white max-md:absolute max-md:left-0 max-md:top-0 max-md:z-30 max-md:shadow-2xl">
      <header className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5">
        <h2 className="text-xs font-bold tracking-wide text-slate-700">탐색기</h2>
        <span className="ml-auto mr-1 text-[10px] text-slate-400">{workspaces.length}</span>
        <button
          onClick={toggle}
          className="rounded px-1 text-slate-400 hover:bg-slate-100"
          aria-label="탐색기 닫기"
        >
          ◀
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto py-1" data-testid="board-explorer">
        {groups.length === 0 && (
          <p className="px-3 py-4 text-center text-[11px] text-slate-400">
            아직 노드가 없습니다.
          </p>
        )}
        {groups.map(({ kind, nodes }) => {
          const isCollapsed = collapsed.has(kind.id)
          return (
            <div key={kind.id}>
              <button
                onClick={() => toggleGroup(kind.id)}
                className="flex w-full items-center gap-1 px-2 py-1 text-left text-[11px] font-semibold text-slate-500 hover:bg-slate-50"
              >
                <span className="w-3 text-[9px] text-slate-400">{isCollapsed ? '▸' : '▾'}</span>
                <span>{kind.icon}</span>
                <span>{kind.label}</span>
                <span className="ml-auto text-[10px] text-slate-400">{nodes.length}</span>
              </button>
              {!isCollapsed &&
                nodes.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => focus(n.id)}
                    data-node-id={n.id}
                    className={`flex w-full items-center gap-1.5 py-1 pl-6 pr-2 text-left text-[11px] transition-colors ${
                      n.id === selectedId
                        ? 'bg-blue-100 text-blue-800'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${AUTHOR_CONFIG[authorOf(n.author)].dotClass}`}
                      title={AUTHOR_CONFIG[authorOf(n.author)].label}
                    />
                    <span className="min-w-0 flex-1 truncate">{n.name}</span>
                    {n.id === pointerId && <span className="shrink-0 text-[10px]">📍</span>}
                  </button>
                ))}
            </div>
          )
        })}
      </div>
    </nav>
  )
}
