import { useEffect } from 'react'
import { PERSONA_LIST } from '../agent/personas'
import type { AgentPersona } from '../agent/types'

export interface ContextMenuState {
  /** 화면 좌표(clientX/Y) */
  x: number
  y: number
  /** 노드 위에서 열렸으면 노드 id, 빈 캔버스면 null */
  nodeId: string | null
  /** 빈 캔버스에서 열렸을 때 노드를 추가할 flow 좌표 */
  flowPosition: { x: number; y: number }
}

interface Props {
  state: ContextMenuState
  onClose: () => void
  onAddNode: (position: { x: number; y: number }) => void
  onDeleteNode: (nodeId: string) => void
  onAgentToNode: (persona: AgentPersona, nodeId: string) => void
}

/**
 * 우클릭 컨텍스트 메뉴 (v2 §Task4).
 * - 빈 캔버스: 여기에 노드 추가
 * - 노드 위: 에이전트 실행(페르소나 선택) · 노드 삭제
 */
export function CanvasContextMenu({
  state,
  onClose,
  onAddNode,
  onDeleteNode,
  onAgentToNode,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const { nodeId } = state
  // 화면 밖으로 나가지 않도록 대략적인 클램프
  const left = Math.min(state.x, window.innerWidth - 200)
  const top = Math.min(state.y, window.innerHeight - 260)

  return (
    <>
      {/* 바깥 클릭 / 우클릭 닫기용 백드롭 */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault()
          onClose()
        }}
      />
      <div
        className="fixed z-50 min-w-[10rem] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-xl"
        style={{ left, top }}
        data-testid="canvas-context-menu"
        onContextMenu={(e) => e.preventDefault()}
      >
        {nodeId === null ? (
          <button
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-slate-700 hover:bg-slate-100"
            onClick={() => {
              onAddNode(state.flowPosition)
              onClose()
            }}
            data-testid="ctx-add-node"
          >
            ➕ 여기에 노드 추가
          </button>
        ) : (
          <>
            <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              에이전트 실행
            </p>
            {PERSONA_LIST.map((p) => (
              <button
                key={p.id}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-slate-700 hover:bg-slate-100"
                onClick={() => {
                  onAgentToNode(p.id, nodeId)
                  onClose()
                }}
                data-persona={p.id}
              >
                <span>{p.icon}</span>
                <span>{p.label}</span>
              </button>
            ))}
            <div className="my-1 border-t border-slate-100" />
            <button
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-red-600 hover:bg-red-50"
              onClick={() => {
                onDeleteNode(nodeId)
                onClose()
              }}
              data-testid="ctx-delete-node"
            >
              🗑️ 노드 삭제
            </button>
          </>
        )}
      </div>
    </>
  )
}
