/** 체크리스트 항목 태그: 실행 주체 또는 예외 종류 */
export type ChecklistTag = 'AI' | 'human' | 'approval' | 'blocking' | 'permission'

/** 항목 생애주기: pending → staged(검토 대기) → committed(스냅샷 확정) */
export type ChecklistStatus = 'pending' | 'staged' | 'committed'

export interface ChecklistComment {
  id: string
  author: string
  text: string
  createdAt: string
}

export interface ActivityLogEntry {
  id: string
  message: string
  createdAt: string
}

export interface ChecklistItem {
  id: string
  /** 소유 작업공간 (선언형 경로, P3b에서 제거 예정) */
  workspaceId: string
  /** 소유 Task (v2 에이전트 경로). 둘 중 하나가 채워진다 */
  taskId?: string
  title: string
  tag: ChecklistTag
  status: ChecklistStatus
  assignee?: string
  comments: ChecklistComment[]
  activityLog: ActivityLogEntry[]
  /** [permission] 예외 항목이 가리키는 context 작업공간 id (M14) */
  relatedWorkspaceId?: string
}
