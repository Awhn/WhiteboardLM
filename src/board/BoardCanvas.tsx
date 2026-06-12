import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type FinalConnectionState,
  type NodeChange,
  type OnConnectStartParams,
} from '@xyflow/react'
import { useBoardStore } from './boardStore'
import { useUIStore } from './uiStore'
import { exportBoardToServer, serverSyncAvailable } from '../api/sync'
import { WorkspaceNode, type WorkspaceNodeType } from '../workspace/WorkspaceNode'
import { EDGE_TYPE_CONFIG } from '../edge/edgeConfig'
import { EdgeInspector } from '../edge/EdgeInspector'
import { importFilesToBoard } from '../files/importFiles'
import { ACCEPT_ATTRIBUTE, SUPPORTED_LABEL } from '../files/registry'
import { TemplateMenu } from '../workspace/TemplateMenu'
import { instantiateTemplate } from '../workspace/instantiateTemplate'

/** 엣지 드래그 중 이 시간(ms) 동안 정지하면 템플릿 오버레이를 띄운다 */
const PAUSE_MS = 600
const PAUSE_MOVE_TOLERANCE = 8

interface TemplateMenuState {
  x: number
  y: number
  clientX: number
  clientY: number
  sourceId: string
  mode: 'drag' | 'click'
  /** 드롭 직후 발생하는 pane click이 메뉴를 닫지 않도록 오픈 시각 기록 */
  openedAt: number
}

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
  const [dropActive, setDropActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition } = useReactFlow()

  const [templateMenu, setTemplateMenu] = useState<TemplateMenuState | null>(null)
  const templateMenuRef = useRef<TemplateMenuState | null>(null)
  useEffect(() => {
    templateMenuRef.current = templateMenu
  }, [templateMenu])
  /** 연결 드래그 추적(정지 감지) 해제 함수 */
  const connectCleanupRef = useRef<(() => void) | null>(null)

  const toLocal = useCallback((clientX: number, clientY: number) => {
    const rect = wrapperRef.current?.getBoundingClientRect()
    if (!rect) return { x: clientX, y: clientY }
    return {
      x: Math.min(clientX - rect.left + 10, rect.width - 270),
      y: Math.min(clientY - rect.top + 10, rect.height - 280),
    }
  }, [])

  const openTemplateMenu = useCallback(
    (clientX: number, clientY: number, sourceId: string, mode: 'drag' | 'click') => {
      const { x, y } = toLocal(clientX, clientY)
      setTemplateMenu({ x, y, clientX, clientY, sourceId, mode, openedAt: Date.now() })
    },
    [toLocal],
  )

  // 엣지 드래그 시작: 커서가 잠시 멈추면 템플릿 오버레이 표시
  const onConnectStart = useCallback(
    (event: MouseEvent | TouchEvent, params: OnConnectStartParams) => {
      const sourceId = params.nodeId
      if (!sourceId || !(event instanceof MouseEvent)) return
      setTemplateMenu(null)

      let lastX = event.clientX
      let lastY = event.clientY
      let timer: number | null = null

      const showIfNotOverNode = (cx: number, cy: number) => {
        // 다른 노드 위에서 멈춘 경우는 일반 연결 의도로 보고 띄우지 않는다
        const el = document.elementFromPoint(cx, cy)
        if (el?.closest('.react-flow__node')) {
          arm(cx, cy)
          return
        }
        openTemplateMenu(cx, cy, sourceId, 'drag')
      }

      const arm = (cx: number, cy: number) => {
        if (timer !== null) window.clearTimeout(timer)
        timer = window.setTimeout(() => showIfNotOverNode(cx, cy), PAUSE_MS)
      }

      const onMove = (e: MouseEvent) => {
        // 오버레이가 이미 떠 있으면 카드로 이동하는 중이므로 유지
        if (templateMenuRef.current?.mode === 'drag') return
        if (
          Math.abs(e.clientX - lastX) > PAUSE_MOVE_TOLERANCE ||
          Math.abs(e.clientY - lastY) > PAUSE_MOVE_TOLERANCE
        ) {
          lastX = e.clientX
          lastY = e.clientY
          arm(e.clientX, e.clientY)
        }
      }

      window.addEventListener('mousemove', onMove)
      arm(lastX, lastY)
      connectCleanupRef.current = () => {
        window.removeEventListener('mousemove', onMove)
        if (timer !== null) window.clearTimeout(timer)
        connectCleanupRef.current = null
      }
    },
    [openTemplateMenu],
  )

  const createFromTemplate = useCallback(
    (templateId: string, sourceId: string, clientX: number, clientY: number) => {
      const position = screenToFlowPosition({ x: clientX, y: clientY })
      void instantiateTemplate(sourceId, templateId, position)
      setTemplateMenu(null)
    },
    [screenToFlowPosition],
  )

  // 엣지 드래그 종료: 템플릿 카드 위에 놓으면 생성, 빈 캔버스면 클릭 모드 메뉴
  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, connectionState: FinalConnectionState) => {
      connectCleanupRef.current?.()
      const sourceId = connectionState.fromNode?.id
      if (connectionState.isValid || !sourceId || !(event instanceof MouseEvent)) {
        setTemplateMenu(null)
        return
      }

      const card = (event.target as HTMLElement | null)?.closest?.('[data-template-id]')
      const menu = templateMenuRef.current
      if (card && menu) {
        createFromTemplate(
          card.getAttribute('data-template-id') ?? '',
          menu.sourceId,
          menu.clientX,
          menu.clientY,
        )
        return
      }
      if (!menu) {
        // 일시정지 없이 빈 캔버스에 드롭 → 같은 메뉴를 클릭 모드로
        openTemplateMenu(event.clientX, event.clientY, sourceId, 'click')
        return
      }
      setTemplateMenu(null)
    },
    [createFromTemplate, openTemplateMenu],
  )

  const handleImport = useCallback(
    async (files: Iterable<File>, position?: { x: number; y: number }) => {
      const { errors } = await importFilesToBoard(files, position)
      if (errors.length > 0) window.alert(errors.join('\n'))
    },
    [],
  )

  // Padlet 스타일: 파일을 캔버스에 드래그&드롭하면 그 위치에 컨텍스트 노드 생성
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
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onPaneClick={() =>
          setTemplateMenu((menu) => (menu && Date.now() - menu.openedAt < 300 ? menu : null))
        }
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={['Backspace', 'Delete']}
        zoomOnDoubleClick={false}
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
              onClick={() => fileInputRef.current?.click()}
              title={`파일을 컨텍스트 노드로 가져오기 (지원: ${SUPPORTED_LABEL}) — 캔버스에 드래그&드롭도 가능`}
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

      {templateMenu && (
        <TemplateMenu
          x={templateMenu.x}
          y={templateMenu.y}
          sourceId={templateMenu.sourceId}
          mode={templateMenu.mode}
          onSelect={(templateId) =>
            createFromTemplate(
              templateId,
              templateMenu.sourceId,
              templateMenu.clientX,
              templateMenu.clientY,
            )
          }
          onClose={() => setTemplateMenu(null)}
        />
      )}

      {dropActive && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center border-4 border-dashed border-blue-400 bg-blue-50/60">
          <p className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-blue-600 shadow">
            📎 여기에 놓으면 컨텍스트 작업공간으로 추가됩니다 ({SUPPORTED_LABEL})
          </p>
        </div>
      )}
    </div>
  )
}
