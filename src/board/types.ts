/** committed 시점의 작업공간 내용 스냅샷 — 임의 시점 되돌리기 지원 */
export interface Snapshot {
  id: string
  workspaceId: string
  checklistItemId: string
  content: string
  createdAt: string
}
