import { useCallback, useMemo, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react'
import { useBoardStore } from './boardStore'
import { useUIStore } from './uiStore'
import { exportBoardToServer, serverSyncAvailable } from '../api/sync'
import { WorkspaceNode, type WorkspaceNodeType } from '../workspace/WorkspaceNode'
import { EDGE_TYPE_CONFIG } from '../edge/edgeConfig'
import { EdgeInspector } from '../edge/EdgeInspector'

const nodeTypes = { workspace: WorkspaceNode }

export function BoardCanvas() {
  const workspaces = useBoardStore((s) => s.workspaces)
  const storeEdges = useBoardStore((s) => s.edges)
  const selectedWorkspaceId = useBoardStore((s) => s.selectedWorkspaceId)
  const addWorkspace = useBoardStore((s) => s.addWorkspace)
  const moveWorkspace = useBoardStore((s) => s.moveWorkspace)
  const resizeWorkspace = useBoardStore((s) => s.resizeWorkspace)
  const removeWorkspace = useBoardStore((s) => s.removeWorkspace)
  const selectWorkspace = useBoardStore((s) => s.selectWorkspace)
  const addEdge = useBoardStore((s) => s.addEdge)
  const removeEdge = useBoardStore((s) => s.removeEdge)
  const toggleDrawer = useUIStore((s) => s.toggleDrawer)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)

  const nodes = useMemo<WorkspaceNodeType[]>(
    () =>
      workspaces.map((ws) => ({
        id: ws.id,
        type: 'workspace',
        position: ws.position,
        width: ws.size.width,
        height: ws.size.height,
        selected: ws.id === selectedWorkspaceId,
        data: { workspace: ws },
      })),
    [workspaces, selectedWorkspaceId],
  )

  const edges = useMemo<Edge[]>(
    () =>
      storeEdges.map((e) => {
        const cfg = EDGE_TYPE_CONFIG[e.type]
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          selected: e.id === selectedEdgeId,
          label: `${cfg.icon} ${cfg.label}${e.hopLimit === 2 ? ' · 2hop' : ''}${e.disabled ? ' (비활성)' : ''}`,
          animated: !e.disabled && cfg.animated,
          style: {
            stroke: cfg.stroke,
            strokeWidth: cfg.strokeWidth,
            strokeDasharray: cfg.dash,
            opacity: e.disabled ? 0.3 : 1,
          },
          labelStyle: { fontSize: 10, fill: e.disabled ? '#94a3b8' : '#475569' },
          labelBgStyle: { fill: '#ffffff', fillOpacity: 0.85 },
          markerEnd: { type: MarkerType.ArrowClosed, color: cfg.stroke },
        }
      }),
    [storeEdges, selectedEdgeId],
  )

  const onNodesChange = useCallback(
    (changes: NodeChange<WorkspaceNodeType>[]) => {
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          moveWorkspace(change.id, change.position)
        } else if (change.type === 'dimensions' && change.dimensions && change.resizing) {
          resizeWorkspace(change.id, change.dimensions)
        } else if (change.type === 'remove') {
          removeWorkspace(change.id)
        } else if (change.type === 'select') {
          if (change.selected) {
            selectWorkspace(change.id)
          } else if (useBoardStore.getState().selectedWorkspaceId === change.id) {
            selectWorkspace(null)
          }
        }
      }
    },
    [moveWorkspace, resizeWorkspace, removeWorkspace, selectWorkspace],
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      for (const change of changes) {
        if (change.type === 'remove') {
          removeEdge(change.id)
          setSelectedEdgeId((cur) => (cur === change.id ? null : cur))
        } else if (change.type === 'select') {
          setSelectedEdgeId((cur) =>
            change.selected ? change.id : cur === change.id ? null : cur,
          )
        }
      }
    },
    [removeEdge],
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        addEdge(connection.source, connection.target)
      }
    },
    [addEdge],
  )

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={['Backspace', 'Delete']}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} />
        <Controls />
        <MiniMap pannable zoomable />

        <Panel position="top-left">
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <h1 className="text-sm font-bold tracking-tight text-slate-800">🪧 WhiteboardLM</h1>
            <button
              onClick={() => addWorkspace()}
              className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-700"
            >
              + 작업공간 추가
            </button>
            <button
              onClick={() => toggleDrawer('checklist')}
              className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100"
            >
              📋 전체 체크리스트
            </button>
            <button
              onClick={() => toggleDrawer('log')}
              className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100"
            >
              🕘 로그
            </button>
            {serverSyncAvailable && (
              <button
                onClick={() => {
                  exportBoardToServer().catch((e) => window.alert(String(e)))
                }}
                title="localStorage 보드 상태를 서버 DB로 이전"
                className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100"
              >
                ☁️ 서버 저장
              </button>
            )}
          </div>
        </Panel>

        {workspaces.length === 0 && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div className="pointer-events-auto flex flex-col items-center gap-4 rounded-2xl border border-dashed border-slate-300 bg-white/80 px-12 py-10 text-center shadow-sm backdrop-blur">
              <p className="text-lg font-semibold text-slate-700">보드가 비어 있습니다</p>
              <p className="max-w-xs text-sm text-slate-500">
                작업공간을 추가하고 선언형 정의를 작성하면 AI 포인터가 체크리스트를 따라
                실행합니다.
              </p>
              <button
                onClick={() => addWorkspace()}
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow transition-colors hover:bg-blue-700"
              >
                + 첫 작업공간 만들기
              </button>
            </div>
          </div>
        )}
      </ReactFlow>

      {selectedEdgeId && (
        <EdgeInspector edgeId={selectedEdgeId} onClose={() => setSelectedEdgeId(null)} />
      )}
    </div>
  )
}
