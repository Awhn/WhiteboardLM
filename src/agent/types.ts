/** 에이전트 페르소나 — 능력(Capability)을 가진 정체성 (v2 §4) */
export type AgentPersona =
  | 'researcher'
  | 'writer'
  | 'summarizer'
  | 'organizer'
  | 'reviewer'

export type AgentStatus = 'idle' | 'working' | 'waiting'

export interface Agent {
  id: string
  persona: AgentPersona
  status: AgentStatus
}

/** 특정 시점의 의도(Intent) — 에이전트 드롭으로 생성 (v2 추가 개념) */
export type TaskStatus = 'proposed' | 'running' | 'waiting' | 'done'

export interface Task {
  id: string
  agentId: string
  /** 드롭된 기준 노드 */
  anchorNodeId: string
  /** AI가 제안하고 사용자가 교정한 미션 */
  mission: string
  /** 공간 컨텍스트로 수집된 노드 */
  contextNodeIds: string[]
  /** 생성된 AI 결과 노드 */
  outputNodeId?: string
  status: TaskStatus
  createdAt: string
}
