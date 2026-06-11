import { Handle, NodeResizer, Position, type Node, type NodeProps } from '@xyflow/react'
import type { Workspace } from './types'
import { WORKSPACE_TYPE_CONFIG, canPointerEnter } from './typeConfig'
import { isDeclarationComplete } from './declaration'
import { PointerBadge } from '../pointer/PointerBadge'
import { runPointerAt } from '../pointer/runner'
import { ChecklistSection } from '../checklist/ChecklistSection'

export type WorkspaceNodeType = Node<{ workspace: Workspace }, 'workspace'>

/** 보드 위의 작업공간 노드 윈도우 (드래그 이동 + 선택 시 리사이즈) */
export function WorkspaceNode({ data, selected }: NodeProps<WorkspaceNodeType>) {
  const ws = data.workspace
  const config = WORKSPACE_TYPE_CONFIG[ws.type]
  const complete = isDeclarationComplete(ws)
  const fields = ws.declaration.dynamicFields
  const filledCount = fields.filter((f) => f.value.trim()).length

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

        <div className="nodrag nowheel flex-1 overflow-auto p-3 text-xs leading-relaxed text-slate-600">
          {ws.content ? (
            <pre className="whitespace-pre-wrap font-sans">{ws.content}</pre>
          ) : ws.declaration.purpose ? (
            <div className="space-y-1.5">
              <p>{ws.declaration.purpose}</p>
              {fields.length > 0 && (
                <p className="text-[10px] text-slate-400">
                  동적 필드 {fields.length}개 중 {filledCount}개 입력됨
                </p>
              )}
            </div>
          ) : (
            <span className="italic text-slate-400">
              노드를 선택하면 우측 정의 패널에서 목적을 입력할 수 있습니다.
            </span>
          )}
        </div>

        <ChecklistSection workspaceId={ws.id} />

        <Handle type="target" position={Position.Left} className="!h-3 !w-3 !bg-slate-400" />
        <Handle type="source" position={Position.Right} className="!h-3 !w-3 !bg-slate-400" />
      </div>
    </div>
  )
}
