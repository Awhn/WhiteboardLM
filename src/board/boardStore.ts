import { create } from 'zustand'
import type { Declaration, Workspace, WorkspaceType } from '../workspace/types'
import { canPointerEnter } from '../workspace/typeConfig'
import type { WorkspaceEdge, EdgeType } from '../edge/types'
import type { Pointer } from '../pointer/types'

const DEFAULT_SIZE = { width: 320, height: 220 }

let idCounter = 0
const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${(idCounter++).toString(36)}`

interface BoardState {
  workspaces: Workspace[]
  edges: WorkspaceEdge[]
  pointer: Pointer
  selectedWorkspaceId: string | null

  addWorkspace: (partial?: Partial<Pick<Workspace, 'name' | 'type' | 'position'>>) => Workspace
  updateWorkspace: (id: string, patch: Partial<Workspace>) => void
  updateDeclaration: (id: string, patch: Partial<Declaration>) => void
  setDynamicFieldValue: (id: string, fieldId: string, value: string) => void
  moveWorkspace: (id: string, position: { x: number; y: number }) => void
  resizeWorkspace: (id: string, size: { width: number; height: number }) => void
  removeWorkspace: (id: string) => void
  selectWorkspace: (id: string | null) => void

  addEdge: (source: string, target: string, type?: EdgeType) => void
  removeEdge: (id: string) => void

  /** 포인터 이동. context 등 진입 불가 타입이면 거부하고 false 반환 */
  movePointer: (workspaceId: string | null) => boolean
  setPointerStatus: (status: Pointer['status']) => void
}

export const useBoardStore = create<BoardState>((set, get) => ({
  workspaces: [],
  edges: [],
  pointer: { workspaceId: null, status: 'done' },
  selectedWorkspaceId: null,

  addWorkspace: (partial) => {
    const count = get().workspaces.length
    const workspace: Workspace = {
      id: newId('ws'),
      name: partial?.name ?? `작업공간 ${count + 1}`,
      type: partial?.type ?? 'intermediate',
      declaration: { purpose: '', dynamicFields: [] },
      content: '',
      // 새 작업공간이 겹치지 않도록 계단식으로 배치
      position: partial?.position ?? { x: 80 + count * 60, y: 80 + count * 60 },
      size: { ...DEFAULT_SIZE },
    }
    set((s) => ({ workspaces: [...s.workspaces, workspace] }))
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
      pointer:
        s.pointer.workspaceId === id ? { workspaceId: null, status: 'done' } : s.pointer,
      selectedWorkspaceId: s.selectedWorkspaceId === id ? null : s.selectedWorkspaceId,
    })),

  selectWorkspace: (id) => set({ selectedWorkspaceId: id }),

  addEdge: (source, target, type = 'reference') =>
    set((s) => {
      if (s.edges.some((e) => e.source === source && e.target === target)) return s
      const edge: WorkspaceEdge = { id: newId('edge'), source, target, type, hopLimit: 1 }
      return { edges: [...s.edges, edge] }
    }),

  removeEdge: (id) => set((s) => ({ edges: s.edges.filter((e) => e.id !== id) })),

  movePointer: (workspaceId) => {
    if (workspaceId !== null) {
      const target = get().workspaces.find((w) => w.id === workspaceId)
      if (!target || !canPointerEnter(target.type)) return false
    }
    set((s) => ({ pointer: { ...s.pointer, workspaceId } }))
    return true
  },

  setPointerStatus: (status) => set((s) => ({ pointer: { ...s.pointer, status } })),
}))

export type { WorkspaceType }
