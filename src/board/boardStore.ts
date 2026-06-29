import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { NodeKind, Workspace } from '../workspace/types'
import { getKind, resolveKind } from '../workspace/kinds/registry'
import type {
  ActivityLogEntry,
  ChecklistItem,
  ChecklistStatus,
  ChecklistTag,
} from '../checklist/types'
import type { Agent, AgentPersona, AgentStatus, Task } from '../agent/types'
import { PERSONA_LIST } from '../agent/personas'

const DEFAULT_SIZE = { width: 320, height: 220 }

let idCounter = 0
const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${(idCounter++).toString(36)}`

/** pending → staged → committed 순방향 전이와 staged → pending(반려) 역전이만 허용 */
const ALLOWED_TRANSITIONS: Record<ChecklistStatus, ChecklistStatus[]> = {
  pending: ['staged', 'committed'],
  staged: ['committed', 'pending'],
  committed: ['pending'],
}

const seedAgents = (): Agent[] =>
  PERSONA_LIST.map((p) => ({ id: `agent-${p.id}`, persona: p.id, status: 'idle' as AgentStatus }))

interface BoardState {
  workspaces: Workspace[]
  checklistItems: ChecklistItem[]
  /** v2: 에이전트(페르소나) + 태스크 */
  agents: Agent[]
  tasks: Task[]
  /** 보드 전체 행동 로그 */
  boardLog: ActivityLogEntry[]
  selectedWorkspaceId: string | null

  addWorkspace: (partial?: Partial<Omit<Workspace, 'id'>>) => Workspace
  updateWorkspace: (id: string, patch: Partial<Workspace>) => void
  moveWorkspace: (id: string, position: { x: number; y: number }) => void
  resizeWorkspace: (id: string, size: { width: number; height: number }) => void
  removeWorkspace: (id: string) => void
  selectWorkspace: (id: string | null) => void

  addChecklistItem: (
    workspaceId: string,
    title: string,
    tag: ChecklistTag,
    options?: { relatedWorkspaceId?: string; assignee?: string; reason?: string; taskId?: string },
  ) => ChecklistItem
  /** Task 소유 체크리스트를 통째로 교체 (v2) */
  setChecklistForTask: (taskId: string, items: { tag: ChecklistTag; title: string }[]) => void

  /** v2 에이전트/태스크 */
  setAgentStatus: (agentId: string, status: AgentStatus) => void
  createTask: (input: {
    persona: AgentPersona
    anchorNodeId: string
    mission: string
    contextNodeIds: string[]
  }) => Task
  updateTask: (id: string, patch: Partial<Task>) => void
  /** 허용된 전이만 수행. 성공 여부 반환 */
  setChecklistItemStatus: (itemId: string, status: ChecklistStatus) => boolean
  appendItemActivity: (itemId: string, message: string) => void
  removeChecklistItem: (itemId: string) => void

  /** 보드 행동 로그에 한 줄 기록 */
  logBoard: (message: string) => void
  /** 반려: staged → pending + 코멘트 기록 → AI 재작업 대상 */
  rejectChecklistItem: (itemId: string, comment: string) => boolean
}

export const useBoardStore = create<BoardState>()(
  persist(
    (set, get) => ({
  workspaces: [],
  checklistItems: [],
  agents: seedAgents(),
  tasks: [],
  boardLog: [],
  selectedWorkspaceId: null,

  setAgentStatus: (agentId, status) =>
    set((s) => ({
      agents: s.agents.map((a) => (a.id === agentId ? { ...a, status } : a)),
    })),

  createTask: ({ persona, anchorNodeId, mission, contextNodeIds }) => {
    const task: Task = {
      id: newId('task'),
      agentId: `agent-${persona}`,
      anchorNodeId,
      mission,
      contextNodeIds,
      status: 'proposed',
      createdAt: new Date().toISOString(),
    }
    set((s) => ({ tasks: [...s.tasks, task] }))
    get().logBoard(`Task 생성: ${mission}`)
    return task
  },

  updateTask: (id, patch) =>
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),

  setChecklistForTask: (taskId, items) =>
    set((s) => ({
      checklistItems: [
        ...s.checklistItems.filter((i) => i.taskId !== taskId),
        ...items.map(({ tag, title }) => ({
          id: newId('item'),
          workspaceId: '',
          taskId,
          title,
          tag,
          status: 'pending' as const,
          comments: [],
          activityLog: [
            { id: newId('log'), message: '체크리스트 자동 생성됨', createdAt: new Date().toISOString() },
          ],
        })),
      ],
    })),

  addWorkspace: (partial) => {
    const count = get().workspaces.length
    const kind: NodeKind = resolveKind(partial ?? {})
    const kindDef = getKind(kind)
    const workspace: Workspace = {
      content: '',
      size: { ...DEFAULT_SIZE },
      ...kindDef.createInitial?.(),
      ...partial,
      id: newId('ws'),
      kind,
      // 명시 지정이 없으면 인간 생성으로 본다 (AI 생성은 러너가 명시)
      author: partial?.author ?? 'human',
      name: partial?.name ?? `작업공간 ${count + 1}`,
      // 새 작업공간이 기존 노드와 겹치지 않도록 가로로 펼쳐 배치
      position:
        partial?.position ?? { x: 80 + count * (DEFAULT_SIZE.width + 60), y: 80 + count * 40 },
    }
    set((s) => ({ workspaces: [...s.workspaces, workspace] }))
    get().logBoard(`작업공간 추가: ${workspace.name}`)
    return workspace
  },

  updateWorkspace: (id, patch) =>
    set((s) => ({
      workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, ...patch } : w)),
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
      selectedWorkspaceId: s.selectedWorkspaceId === id ? null : s.selectedWorkspaceId,
    })),

  addChecklistItem: (workspaceId, title, tag, options) => {
    const isException = tag === 'blocking' || tag === 'permission'
    const item: ChecklistItem = {
      id: newId('item'),
      workspaceId,
      taskId: options?.taskId,
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

  logBoard: (message) =>
    set((s) => ({
      boardLog: [
        ...s.boardLog,
        { id: newId('log'), message, createdAt: new Date().toISOString() },
      ],
    })),

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
    }),
    {
      name: 'whiteboardlm-board',
      version: 3,
      migrate: (persisted) => {
        const state = persisted as { workspaces?: Workspace[] } | undefined
        if (state?.workspaces) {
          state.workspaces = state.workspaces.map((w) => ({
            ...w,
            // attachment 유무로 kind 유도 (declarative는 note로 강등)
            kind: (w.kind && w.kind !== 'declarative' ? w.kind : w.attachment ? 'file' : 'note'),
            author: w.author ?? 'human',
          }))
        }
        return persisted
      },
      partialize: (s) => ({
        workspaces: s.workspaces,
        checklistItems: s.checklistItems,
        tasks: s.tasks,
        boardLog: s.boardLog,
      }),
    },
  ),
)

