import { useState } from 'react'
import { NodeResizer, type Node, type NodeProps } from '@xyflow/react'
import type { Workspace } from './types'
import { WORKSPACE_TYPE_CONFIG } from './typeConfig'
import { kindOf } from './kinds/registry'
import { AUTHOR_CONFIG, authorOf } from './authorConfig'

export type WorkspaceNodeType = Node<{ workspace: Workspace }, 'workspace'>

/**
 * 보드 위의 Post-it 노드 (드래그 이동 + 선택 시 리사이즈).
 * WYSIWYG: 본문에는 콘텐츠만 표시. 인간이 직접 편집(✏️)하거나,
 * 하단 독의 에이전트가 이 노드를 컨텍스트로 새 노드를 만든다.
 */
export function WorkspaceNode({ data, selected }: NodeProps<WorkspaceNodeType>) {
  const ws = data.workspace
  const config = WORKSPACE_TYPE_CONFIG[ws.type]
  const kind = kindOf(ws)
  const author = AUTHOR_CONFIG[authorOf(ws.author)]
  const [editing, setEditing] = useState(false)

  const handleEditingChange = (next: boolean) => setEditing(next)

  return (
    <div className="relative h-full">
      <NodeResizer
        isVisible={selected}
        minWidth={240}
        minHeight={160}
        lineClassName="!border-blue-400"
        handleClassName="!h-2.5 !w-2.5 !rounded-sm !bg-blue-500"
      />

      <div
        className={`flex h-full flex-col overflow-hidden rounded-lg border bg-white shadow-md ${config.borderClass}`}
        data-author={authorOf(ws.author)}
      >
        {/* 생성자 액센트 바 (인간=중립 / AI=인디고) */}
        <div className={`h-1 w-full shrink-0 ${author.accentClass}`} />
        <header
          className={`flex items-center gap-1.5 border-b px-3 py-2 ${config.headerClass}`}
        >
          <span
            className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold ${author.chipClass}`}
            title={`${author.label}이(가) 만든 노드`}
          >
            {author.icon} {author.label}
          </span>
          <span className="truncate text-sm font-semibold text-slate-800">{ws.name}</span>
          <span
            className={`ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${config.badgeClass}`}
            title={kind.description}
          >
            {kind.icon} {kind.label}
          </span>
          {kind.usesEditToggle && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleEditingChange(!editing)
              }}
              title={editing ? '편집 종료' : '콘텐츠 직접 편집'}
              aria-label="콘텐츠 편집"
              className="nodrag shrink-0 rounded px-1 text-xs hover:bg-white/60"
            >
              ✏️
            </button>
          )}
        </header>

        <kind.Body
          workspace={ws}
          editing={editing}
          onEditingChange={handleEditingChange}
        />
      </div>
    </div>
  )
}
