import { Handle, NodeResizer, Position, type Node, type NodeProps } from '@xyflow/react'
import type { Workspace } from './types'

export type WorkspaceNodeType = Node<{ workspace: Workspace }, 'workspace'>

/** 보드 위의 작업공간 노드 윈도우 (드래그 이동 + 선택 시 리사이즈) */
export function WorkspaceNode({ data, selected }: NodeProps<WorkspaceNodeType>) {
  const ws = data.workspace

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-300 bg-white shadow-md">
      <NodeResizer
        isVisible={selected}
        minWidth={240}
        minHeight={160}
        lineClassName="!border-blue-400"
        handleClassName="!h-2.5 !w-2.5 !rounded-sm !bg-blue-500"
      />

      <header className="flex items-center gap-2 border-b border-slate-200 bg-slate-100 px-3 py-2">
        <span className="truncate text-sm font-semibold text-slate-800">{ws.name}</span>
        <span className="ml-auto shrink-0 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
          {ws.type}
        </span>
      </header>

      <div className="flex-1 overflow-auto p-3 text-xs leading-relaxed text-slate-600">
        {ws.content ||
          ws.declaration.purpose || (
            <span className="italic text-slate-400">
              아직 정의가 없습니다. 선언형 정의 패널에서 목적을 입력하세요.
            </span>
          )}
      </div>

      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !bg-slate-400" />
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !bg-slate-400" />
    </div>
  )
}
