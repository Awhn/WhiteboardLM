import { useState } from 'react'
import { Handle, NodeResizer, Position, type Node, type NodeProps } from '@xyflow/react'
import type { Workspace } from './types'
import { WORKSPACE_TYPE_CONFIG, canPointerEnter } from './typeConfig'
import { isDeclarationComplete } from './declaration'
import { WorkspaceContent } from './WorkspaceContent'
import { PointerBadge } from '../pointer/PointerBadge'
import { runPointerAt } from '../pointer/runner'
import { useBoardStore } from '../board/boardStore'
import { POINTER_STATUS_CONFIG } from '../pointer/statusConfig'

export type WorkspaceNodeType = Node<{ workspace: Workspace }, 'workspace'>

/**
 * 보드 위의 작업공간 노드 윈도우 (드래그 이동 + 선택 시 리사이즈).
 * WYSIWYG 원칙: 본문에는 작업 결과 콘텐츠만 표시하며, AI와 사용자가 함께
 * 작성·편집한다 (더블클릭/✏️ → 마크다운·텍스트 에디터).
 * 정의·체크리스트 등 메타 작업은 우측 사이드바에서 수행.
 */
export function WorkspaceNode({ data, selected }: NodeProps<WorkspaceNodeType>) {
  const ws = data.workspace
  const config = WORKSPACE_TYPE_CONFIG[ws.type]
  const complete = isDeclarationComplete(ws)
  const [editing, setEditing] = useState(false)

  // 포인터가 이 작업공간에서 실행 중이면 동시 수정 충돌을 막기 위해 편집 잠금
  const pointerBusy = useBoardStore(
    (s) =>
      s.pointer.workspaceId === ws.id && POINTER_STATUS_CONFIG[s.pointer.status].active,
  )

  const handleEditingChange = (next: boolean) => {
    if (next && pointerBusy) return
    setEditing(next)
  }

  return (
    <div className="relative h-full">
      <PointerBadge workspaceId={ws.id} />
      <NodeResizer
        isVisible={selected}
        minWidth={240}
        minHeight={160}
        lineClassName="!border-blue-400"
        handleClassName="!h-2.5 !w-2.5 !rounded-sm !bg-blue-500"
      />

      <div
        className={`flex h-full flex-col overflow-hidden rounded-lg border bg-white shadow-md ${config.borderClass}`}
      >
        <header
          className={`flex items-center gap-1.5 border-b px-3 py-2 ${config.headerClass}`}
        >
          <span className="shrink-0 text-sm">{config.icon}</span>
          <span className="truncate text-sm font-semibold text-slate-800">{ws.name}</span>
          <span
            className="shrink-0 text-[10px]"
            title={complete ? '정의 완료' : '정의 미완료'}
          >
            {complete ? '✅' : ''}
          </span>
          <span
            className={`ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${config.badgeClass}`}
            title={config.description}
          >
            {config.icon} {config.label}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleEditingChange(!editing)
            }}
            disabled={pointerBusy}
            title={
              pointerBusy
                ? 'AI 작업 중에는 편집할 수 없습니다'
                : editing
                  ? '편집 종료'
                  : '콘텐츠 직접 편집'
            }
            aria-label="콘텐츠 편집"
            className="nodrag shrink-0 rounded px-1 text-xs hover:bg-white/60 disabled:opacity-40"
          >
            ✏️
          </button>
          {canPointerEnter(ws.type) && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                void runPointerAt(ws.id)
              }}
              title="포인터를 여기로 이동하고 체크리스트 실행"
              aria-label="포인터 이동"
              className="nodrag shrink-0 rounded px-1 text-xs hover:bg-white/60"
            >
              📍
            </button>
          )}
        </header>

        <WorkspaceContent
          workspace={ws}
          editing={editing}
          onEditingChange={handleEditingChange}
        />

        <Handle type="target" position={Position.Left} className="!h-3 !w-3 !bg-slate-400" />
        <Handle type="source" position={Position.Right} className="!h-3 !w-3 !bg-slate-400" />
      </div>
    </div>
  )
}
