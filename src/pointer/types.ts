/** AI 에이전트 포인터의 상태 머신 상태 */
export type PointerStatus =
  | 'thinking'
  | 'planning'
  | 'working'
  | 'tool_use'
  | 'waiting'
  | 'done'

/** 포인터: AI 에이전트의 현재 위치 (보드당 1개, Phase 1) */
export interface Pointer {
  workspaceId: string | null
  status: PointerStatus
  /** tool_use 상태일 때 사용 중인 도구 id (M12) */
  tool?: string | null
}
