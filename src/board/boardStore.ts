import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Declaration, Workspace, WorkspaceType } from '../workspace/types'
import { canPointerEnter } from '../workspace/typeConfig'
import type { WorkspaceEdge, EdgeType } from '../edge/types'
import type { Pointer, PointerStatus } from '../pointer/types'
import type {
  ActivityLogEntry,
  ChecklistItem,
  ChecklistStatus,
  ChecklistTag,
} from '../checklist/types'
import type { Snapshot } from './types'

const DEFAULT_SIZE = { width: 320, height: 220 }

let idCounter = 0
const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${(idCounter++).toString(36)}`

/** pending → staged → committed 순방향 전이와 staged → pending(반려) 역전이만 허용 */
const ALLOWED_TRANSITIONS: Record<ChecklistStatus, ChecklistStatus[]> = {
  pending: ['staged', 'committed'],
  staged: ['committed', 'pending'],
  committed: ['pending'], // 스냅샷 되돌리기(M8) 시에만
}

/** 재실행 중이 아닌데 진행 중 상태로 복원되는 것을 막기 위한 목록 */
const ACTIVE_POINTER_STATUSES: PointerStatus[] = ['thinking', 'planning', 'working', 'tool_use']

interface BoardState {
  workspaces: Workspace[]
  edges: WorkspaceEdge[]
  pointer: Pointer
  checklistItems: ChecklistItem[]
  snapshots: Snapshot[]
  /** 보드 전체 행동 로그 (우측 로그 패널, M8) */
  boardLog: ActivityLogEntry[]
  selectedWorkspaceId: string | null

  addWorkspace: (partial?: Partial<Pick<Workspace, 'name' | 'type' | 'position'>>) => Workspace
  updateWorkspace: (id: string, patch: Partial<Workspace>) => void
  updateDeclaration: (id: string, patch: Partial<Declaration>) => void
  setDynamicFieldValue: (id: string, fieldId: string, value: string) => void
  moveWorkspace: (id: string, position: { x: number; y: number }) => void
  resizeWorkspace: (id: string, size: { width: number; height: number }) => void
  removeWorkspace: (id: string) => void
  selectWorkspace: (id: string | null) => void

  /** 작업공간의 체크리스트를 통째로 교체 (LLM 생성 결과 반영) */
  setChecklistForWorkspace: (
    workspaceId: string,
    items: { tag: ChecklistTag; title: string }[],
  ) => void
  addChecklistItem: (
    workspaceId: string,
    title: string,
    tag: ChecklistTag,
    options?: { relatedWorkspaceId?: string; assignee?: string; reason?: string },
  ) => ChecklistItem
  /** 허용된 전이만 수행. 성공 여부 반환 */
  setChecklistItemStatus: (itemId: string, status: ChecklistStatus) => boolean
  appendItemActivity: (itemId: string, message: string) => void
  removeChecklistItem: (itemId: string) => void

  addEdge: (source: string, target: string, type?: EdgeType) => void
  updateEdge: (id: string, patch: Partial<Omit<WorkspaceEdge, 'id'>>) => void
  removeEdge: (id: string) => void

  /** 포인터 이동. context 등 진입 불가 타입이면 거부하고 false 반환 */
  movePointer: (workspaceId: string | null) => boolean
  setPointerStatus: (status: Pointer['status'], tool?: string | null) => void
  /** context 작업공간에 포인터 읽기 권한 부여 (M14) */
  grantContextAccess: (workspaceId: string) => void

  /** 보드 행동 로그에 한 줄 기록 */
  logBoard: (message: string) => void
  /** 승인: staged(또는 인간/승인 pending) → committed + 스냅샷 저장 (M7) */
  approveChecklistItem: (itemId: string) => boolean
  /** 반려: staged → pending + 코멘트 기록 → AI 재작업 대상 (M7) */
  rejectChecklistItem: (itemId: string, comment: string) => boolean
  /** 스냅샷 복원: content 되돌리기 + 이후 committed/staged 항목 pending 전환 (M8) */
  restoreSnapshot: (snapshotId: string) => boolean
}

export const useBoardStore = create<BoardState>()(
  persist(
    (set, get) => ({
  workspaces: [],
  edges: [],
  pointer: { workspaceId: null, status: 'done' },
  checklistItems: [],
  snapshots: [],
  boardLog: [],
  selectedWorkspaceId: null,

  addWorkspace: (partial) => {
    const count = get().workspaces.length
    const workspace: Workspace = {
      id: newId('ws'),
      name: partial?.name ?? `작업공간 ${count + 1}`,
      type: partial?.type ?? 'intermediate',
      declaration: { purpose: '', dynamicFields: [] },
      content: '',
      // 새 작업공간이 기존 노드와 겹치지 않도록 가로로 펼쳐 배치
      position:
        partial?.position ?? { x: 80 + count * (DEFAULT_SIZE.width + 60), y: 80 + count * 40 },
      size: { ...DEFAULT_SIZE },
    }
    set((s) => ({ workspaces: [...s.workspaces, workspace] }))
    get().logBoard(`작업공간 추가: ${workspace.name}`)
    return workspace
  },

  updateWorkspace: (id, patch) =>
    set((s) => {
      const workspaces = s.workspaces.map((w) => (w.id === id ? { ...w, ...patch } : w))
      // 타입이 진입 불가로 바뀌면 그 위에 있던 포인터를 내보낸다
      const evictPointer =
        patch.type !== undefined &&
        s.pointer.workspaceId === id &&
        !canPointerEnter(patch.type)
      return {
        workspaces,
        pointer: evictPointer ? { ...s.pointer, workspaceId: null } : s.pointer,
      }
    }),

  updateDeclaration: (id, patch) =>
    set((s) => ({
      workspaces: s.workspaces.map((w) =>
        w.id === id ? { ...w, declaration: { ...w.declaration, ...patch } } : w,
      ),
    })),

  setDynamicFieldValue: (id, fieldId, value) =>
    set((s) => ({
      workspaces: s.workspaces.map((w) =>
        w.id === id
          ? {
              ...w,
              declaration: {
                ...w.declaration,
                dynamicFields: w.declaration.dynamicFields.map((f) =>
                  f.id === fieldId ? { ...f, value } : f,
                ),
              },
            }
          : w,
      ),
    })),

  moveWorkspace: (id, position) =>
    set((s) => ({
      workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, position } : w)),
    })),

  resizeWorkspace: (id, size) =>
    set((s) => ({
      workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, size } : w)),
    })),

  removeWorkspace: (id) =>
    set((s) => ({
      workspaces: s.workspaces.filter((w) => w.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
      checklistItems: s.checklistItems.filter((i) => i.workspaceId !== id),
      pointer:
        s.pointer.workspaceId === id ? { workspaceId: null, status: 'done' } : s.pointer,
      selectedWorkspaceId: s.selectedWorkspaceId === id ? null : s.selectedWorkspaceId,
    })),

  setChecklistForWorkspace: (workspaceId, items) => {
    set((s) => ({
      checklistItems: [
        ...s.checklistItems.filter((i) => i.workspaceId !== workspaceId),
        ...items.map(({ tag, title }) => ({
          id: newId('item'),
          workspaceId,
          title,
          tag,
          status: 'pending' as const,
          comments: [],
          activityLog: [
            {
              id: newId('log'),
              message: '체크리스트 자동 생성됨',
              createdAt: new Date().toISOString(),
            },
          ],
        })),
      ],
    }))
    const wsName = get().workspaces.find((w) => w.id === workspaceId)?.name ?? workspaceId
    get().logBoard(`체크리스트 생성: ${wsName} — ${items.length}개 항목`)
  },

  addChecklistItem: (workspaceId, title, tag, options) => {
    const isException = tag === 'blocking' || tag === 'permission'
    const item: ChecklistItem = {
      id: newId('item'),
      workspaceId,
      title,
      tag,
      status: 'pending',
      assignee: options?.assignee,
      relatedWorkspaceId: options?.relatedWorkspaceId,
      comments: options?.reason
        ? [
            {
              id: newId('comment'),
              author: 'AI',
              text: options.reason,
              createdAt: new Date().toISOString(),
            },
          ]
        : [],
      activityLog: [
        {
          id: newId('log'),
          message: isException ? '예외 상황으로 자동 생성됨' : '수동으로 추가됨',
          createdAt: new Date().toISOString(),
        },
      ],
    }
    set((s) => ({ checklistItems: [...s.checklistItems, item] }))
    return item
  },

  setChecklistItemStatus: (itemId, status) => {
    const item = get().checklistItems.find((i) => i.id === itemId)
    if (!item || !ALLOWED_TRANSITIONS[item.status].includes(status)) return false
    set((s) => ({
      checklistItems: s.checklistItems.map((i) =>
        i.id === itemId
          ? {
              ...i,
              status,
              activityLog: [
                ...i.activityLog,
                {
                  id: newId('log'),
                  message: `상태 변경: ${item.status} → ${status}`,
                  createdAt: new Date().toISOString(),
                },
              ],
            }
          : i,
      ),
    }))
    return true
  },

  appendItemActivity: (itemId, message) =>
    set((s) => ({
      checklistItems: s.checklistItems.map((i) =>
        i.id === itemId
          ? {
              ...i,
              activityLog: [
                ...i.activityLog,
                { id: newId('log'), message, createdAt: new Date().toISOString() },
              ],
            }
          : i,
      ),
    })),

  removeChecklistItem: (itemId) =>
    set((s) => ({ checklistItems: s.checklistItems.filter((i) => i.id !== itemId) })),

  selectWorkspace: (id) => set({ selectedWorkspaceId: id }),

  addEdge: (source, target, type = 'reference') =>
    set((s) => {
      if (s.edges.some((e) => e.source === source && e.target === target)) return s
      const edge: WorkspaceEdge = { id: newId('edge'), source, target, type, hopLimit: 1 }
      return { edges: [...s.edges, edge] }
    }),

  updateEdge: (id, patch) =>
    set((s) => ({
      edges: s.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    })),

  removeEdge: (id) => set((s) => ({ edges: s.edges.filter((e) => e.id !== id) })),

  movePointer: (workspaceId) => {
    if (workspaceId !== null) {
      const target = get().workspaces.find((w) => w.id === workspaceId)
      if (!target || !canPointerEnter(target.type)) return false
    }
    set((s) => ({ pointer: { ...s.pointer, workspaceId } }))
    return true
  },

  setPointerStatus: (status, tool = null) =>
    set((s) => ({ pointer: { ...s.pointer, status, tool } })),

  grantContextAccess: (workspaceId) => {
    set((s) => ({
      workspaces: s.workspaces.map((w) =>
        w.id === workspaceId ? { ...w, accessGranted: true } : w,
      ),
    }))
    const name = get().workspaces.find((w) => w.id === workspaceId)?.name ?? workspaceId
    get().logBoard(`권한 부여: 컨텍스트 작업공간 「${name}」 읽기 허용`)
  },

  logBoard: (message) =>
    set((s) => ({
      boardLog: [
        ...s.boardLog,
        { id: newId('log'), message, createdAt: new Date().toISOString() },
      ],
    })),

  approveChecklistItem: (itemId) => {
    const state = get()
    const item = state.checklistItems.find((i) => i.id === itemId)
    if (!item) return false
    const ws = state.workspaces.find((w) => w.id === item.workspaceId)
    if (!ws) return false
    if (!state.setChecklistItemStatus(itemId, 'committed')) return false
    const snapshot: Snapshot = {
      id: newId('snap'),
      workspaceId: ws.id,
      checklistItemId: itemId,
      content: ws.content,
      createdAt: new Date().toISOString(),
    }
    set((s) => ({ snapshots: [...s.snapshots, snapshot] }))
    get().logBoard(`「${item.title}」 committed — 스냅샷 저장 (${ws.name})`)

    // M12: 작업공간의 모든 항목이 committed되면 update 엣지로 결과 전파
    const after = get()
    const wsItems = after.checklistItems.filter((i) => i.workspaceId === ws.id)
    if (wsItems.length > 0 && wsItems.every((i) => i.status === 'committed')) {
      const outgoing = after.edges.filter(
        (e) => e.source === ws.id && e.type === 'update' && !e.disabled,
      )
      for (const edge of outgoing) {
        const target = after.workspaces.find((w) => w.id === edge.target)
        if (!target) continue
        const block = `📥 「${ws.name}」 작업 결과 반영:\n${ws.content}`
        after.updateWorkspace(target.id, {
          content: target.content ? `${target.content}\n\n${block}` : block,
        })
        get().logBoard(`update 엣지 전파: ${ws.name} → ${target.name}`)
      }
    }
    return true
  },

  rejectChecklistItem: (itemId, comment) => {
    const state = get()
    const item = state.checklistItems.find((i) => i.id === itemId)
    if (!item || !state.setChecklistItemStatus(itemId, 'pending')) return false
    set((s) => ({
      checklistItems: s.checklistItems.map((i) =>
        i.id === itemId
          ? {
              ...i,
              comments: [
                ...i.comments,
                {
                  id: newId('comment'),
                  author: '사용자',
                  text: comment,
                  createdAt: new Date().toISOString(),
                },
              ],
            }
          : i,
      ),
    }))
    get().logBoard(`「${item.title}」 반려 — 코멘트: ${comment}`)
    return true
  },

  restoreSnapshot: (snapshotId) => {
    const state = get()
    const snap = state.snapshots.find((x) => x.id === snapshotId)
    if (!snap) return false
    const laterSnapshots = state.snapshots.filter(
      (x) => x.workspaceId === snap.workspaceId && x.createdAt > snap.createdAt,
    )
    const resetItemIds = new Set(laterSnapshots.map((x) => x.checklistItemId))
    const restoredItem = state.checklistItems.find((i) => i.id === snap.checklistItemId)

    set((s) => ({
      workspaces: s.workspaces.map((w) =>
        w.id === snap.workspaceId ? { ...w, content: snap.content } : w,
      ),
      // 되돌린 시점 이후의 스냅샷은 폐기 (Phase 1: 단일 작업공간 범위)
      snapshots: s.snapshots.filter((x) => !laterSnapshots.some((l) => l.id === x.id)),
      checklistItems: s.checklistItems.map((i) => {
        if (i.workspaceId !== snap.workspaceId) return i
        const shouldReset =
          resetItemIds.has(i.id) || (i.status === 'staged' && i.id !== snap.checklistItemId)
        if (!shouldReset) return i
        return {
          ...i,
          status: 'pending' as const,
          activityLog: [
            ...i.activityLog,
            {
              id: newId('log'),
              message: '스냅샷 복원으로 pending 전환',
              createdAt: new Date().toISOString(),
            },
          ],
        }
      }),
    }))
    get().logBoard(
      `스냅샷 복원: 「${restoredItem?.title ?? snap.checklistItemId}」 committed 시점으로 되돌림`,
    )
    return true
  },
    }),
    {
      name: 'whiteboardlm-board',
      partialize: (s) => ({
        workspaces: s.workspaces,
        edges: s.edges,
        pointer: s.pointer,
        checklistItems: s.checklistItems,
        snapshots: s.snapshots,
        boardLog: s.boardLog,
      }),
      onRehydrateStorage: () => (state) => {
        // 새로고침 시 실행 중이던 포인터는 대기 상태로 정규화
        if (state && ACTIVE_POINTER_STATUSES.includes(state.pointer.status)) {
          state.pointer.status = 'waiting'
        }
      },
    },
  ),
)

export type { WorkspaceType }
