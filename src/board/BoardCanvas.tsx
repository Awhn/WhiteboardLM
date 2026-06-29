import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  SelectionMode,
  useReactFlow,
  type NodeChange,
} from '@xyflow/react'
import { useBoardStore } from './boardStore'
import { useUIStore } from './uiStore'
import { exportBoardToServer, serverSyncAvailable } from '../api/sync'
import { WorkspaceNode, type WorkspaceNodeType } from '../workspace/WorkspaceNode'
import { importFilesToBoard } from '../files/importFiles'
import { ACCEPT_ATTRIBUTE, SUPPORTED_LABEL } from '../files/registry'
import { KindAddMenu } from '../workspace/KindAddMenu'
import { AgentDock } from '../agent/AgentDock'
import { MissionBubble } from '../agent/MissionBubble'
import { runTask } from '../agent/runner'
import { buildSpatialContext } from '../pointer/context'
import { CanvasContextMenu, type ContextMenuState } from './CanvasContextMenu'
import type { AgentPersona } from '../agent/types'

interface MissionDraft {
  persona: AgentPersona
  nodeId: string
  anchorName: string
  anchorContent: string
  context: string
  x: number
  y: number
}

const nodeTypes = { workspace: WorkspaceNode }

/**
 * 보드 캔버스 (v2): 명시적 엣지 없음. 노드는 자유 배치된 Post-it이며,
 * 에이전트가 노드 위에서 실행될 때 공간 근접성으로 컨텍스트를 모은다.
 */
export function BoardCanvas() {
  const workspaces = useBoardStore((s) => s.workspaces)
  const selectedWorkspaceId = useBoardStore((s) => s.selectedWorkspaceId)
  const addWorkspace = useBoardStore((s) => s.addWorkspace)
  const moveWorkspace = useBoardStore((s) => s.moveWorkspace)
  const resizeWorkspace = useBoardStore((s) => s.resizeWorkspace)
  const removeWorkspace = useBoardStore((s) => s.removeWorkspace)
  const selectWorkspace = useBoardStore((s) => s.selectWorkspace)
  const setRightTab = useUIStore((s) => s.setRightTab)
  const createTask = useBoardStore((s) => s.createTask)
  const [dropActive, setDropActive] = useState(false)
  const [missionDraft, setMissionDraft] = useState<MissionDraft | null>(null)
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null)
  // 범위(박스) 선택으로 동시에 선택된 노드 집합 (Task3)
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition } = useReactFlow()

  // 에이전트를 노드 위에 드롭하면 미션 말풍선을 띄운다
  const onAgentDrop = useCallback((persona: AgentPersona, nodeId: string) => {
    const all = useBoardStore.getState().workspaces
    const ws = all.find((w) => w.id === nodeId)
    if (!ws) return
    const nodeEl = document.querySelector(
      `.react-flow__node[data-id="${nodeId}"]`,
    ) as HTMLElement | null
    const rect = wrapperRef.current?.getBoundingClientRect()
    const nb = nodeEl?.getBoundingClientRect()
    const x = nb && rect ? nb.left + nb.width / 2 - rect.left : 400
    const y = nb && rect ? nb.top - rect.top : 300
    setMissionDraft({
      persona,
      nodeId,
      anchorName: ws.name,
      anchorContent: ws.content,
      context: buildSpatialContext(nodeId, all).text,
      x,
      y,
    })
  }, [])

  const confirmMission = useCallback(
    (mission: string) => {
      if (!missionDraft) return
      const task = createTask({
        persona: missionDraft.persona,
        anchorNodeId: missionDraft.nodeId,
        mission,
        contextNodeIds: [],
      })
      setMissionDraft(null)
      void runTask(task.id)
    },
    [missionDraft, createTask],
  )

  // 빈 캔버스 더블클릭 → 그 위치에 노드 추가 (Task2)
  const onPaneDoubleClick = useCallback(
    (e: ReactMouseEvent) => {
      const target = e.target as HTMLElement
      // 노드/컨트롤이 아닌 캔버스 배경(pane)에서만 동작
      if (!target.classList.contains('react-flow__pane')) return
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      const ws = addWorkspace({ position })
      selectWorkspace(ws.id)
    },
    [addWorkspace, screenToFlowPosition, selectWorkspace],
  )

  // 노드 우클릭 → 컨텍스트 메뉴 (Task4)
  const onNodeContextMenu = useCallback(
    (e: ReactMouseEvent, node: WorkspaceNodeType) => {
      e.preventDefault()
      setCtxMenu({
        x: e.clientX,
        y: e.clientY,
        nodeId: node.id,
        flowPosition: screenToFlowPosition({ x: e.clientX, y: e.clientY }),
      })
    },
    [screenToFlowPosition],
  )

  // 빈 캔버스 우클릭 → 컨텍스트 메뉴 (Task4)
  const onPaneContextMenu = useCallback(
    (e: MouseEvent | ReactMouseEvent) => {
      e.preventDefault()
      setCtxMenu({
        x: e.clientX,
        y: e.clientY,
        nodeId: null,
        flowPosition: screenToFlowPosition({ x: e.clientX, y: e.clientY }),
      })
    },
    [screenToFlowPosition],
  )

  const handleImport = useCallback(
    async (files: Iterable<File>, position?: { x: number; y: number }) => {
      const { errors } = await importFilesToBoard(files, position)
      if (errors.length > 0) window.alert(errors.join('\n'))
    },
    [],
  )

  // Padlet 스타일: 파일을 캔버스에 드래그&드롭하면 그 위치에 노드 생성
  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      setDropActive(false)
      if (e.dataTransfer.files.length === 0) return
      void handleImport(
        e.dataTransfer.files,
        screenToFlowPosition({ x: e.clientX, y: e.clientY }),
      )
    },
    [handleImport, screenToFlowPosition],
  )

  const nodes = useMemo<WorkspaceNodeType[]>(
    () =>
      workspaces.map((ws) => ({
        id: ws.id,
        type: 'workspace',
        position: ws.position,
        width: ws.size.width,
        height: ws.size.height,
        selected: selectedIds.has(ws.id) || ws.id === selectedWorkspaceId,
        data: { workspace: ws },
      })),
    [workspaces, selectedWorkspaceId, selectedIds],
  )

  const onNodesChange = useCallback(
    (changes: NodeChange<WorkspaceNodeType>[]) => {
      const hasSelectChange = changes.some((c) => c.type === 'select')
      if (hasSelectChange) {
        setSelectedIds((prev) => {
          const next = new Set(prev)
          for (const c of changes) {
            if (c.type !== 'select') continue
            if (c.selected) next.add(c.id)
            else next.delete(c.id)
          }
          return next
        })
      }
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          moveWorkspace(change.id, change.position)
        } else if (change.type === 'dimensions' && change.dimensions && change.resizing) {
          resizeWorkspace(change.id, change.dimensions)
        } else if (change.type === 'remove') {
          removeWorkspace(change.id)
        } else if (change.type === 'select') {
          // 인스펙터용 단일 선택은 store에 유지 (마지막 선택이 우선)
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

  return (
    <div
      ref={wrapperRef}
      className="relative h-full w-full"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault()
          setDropActive(true)
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDropActive(false)
      }}
      onDrop={onDrop}
    >
      <ReactFlow
        nodes={nodes}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={['Backspace', 'Delete']}
        zoomOnDoubleClick={false}
        onDoubleClick={onPaneDoubleClick}
        onNodeContextMenu={onNodeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        panOnDrag={[1, 2]}
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
            <KindAddMenu />
            <button
              onClick={() => fileInputRef.current?.click()}
              title={`파일을 노드로 가져오기 (지원: ${SUPPORTED_LABEL}) — 캔버스에 드래그&드롭도 가능`}
              className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100"
            >
              📎 파일 추가
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_ATTRIBUTE}
              multiple
              className="hidden"
              data-testid="file-input"
              onChange={(e) => {
                if (e.target.files) void handleImport(e.target.files)
                e.target.value = ''
              }}
            />
            <button
              onClick={() => setRightTab('checklist')}
              className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100"
            >
              📋 전체 체크리스트
            </button>
            <button
              onClick={() => setRightTab('log')}
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
                Post-it(노드)을 추가해 생각·자료·결과를 배치하세요. 가까이 둔 노드는 AI가
                컨텍스트로 함께 읽습니다.
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

      {dropActive && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center border-4 border-dashed border-blue-400 bg-blue-50/60">
          <p className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-blue-600 shadow">
            📎 여기에 놓으면 노드로 추가됩니다 ({SUPPORTED_LABEL})
          </p>
        </div>
      )}

      <AgentDock onAgentDrop={onAgentDrop} />

      {missionDraft && (
        <MissionBubble
          persona={missionDraft.persona}
          anchorName={missionDraft.anchorName}
          anchorContent={missionDraft.anchorContent}
          context={missionDraft.context}
          x={missionDraft.x}
          y={missionDraft.y}
          onConfirm={confirmMission}
          onCancel={() => setMissionDraft(null)}
        />
      )}

      {ctxMenu && (
        <CanvasContextMenu
          state={ctxMenu}
          onClose={() => setCtxMenu(null)}
          onAddNode={(position) => {
            const ws = addWorkspace({ position })
            selectWorkspace(ws.id)
          }}
          onDeleteNode={(nodeId) => removeWorkspace(nodeId)}
          onAgentToNode={(persona, nodeId) => onAgentDrop(persona, nodeId)}
        />
      )}
    </div>
  )
}
