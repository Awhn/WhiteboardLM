import { useBoardStore } from '../board/boardStore'

const API_BASE = import.meta.env.VITE_API_BASE as string | undefined

/** 백엔드(M15)가 설정된 경우에만 서버 동기화 UI를 노출한다 */
export const serverSyncAvailable = Boolean(API_BASE)

/** localStorage 보드 상태 전체를 서버 DB로 이전 (PUT /api/boards/default) */
export async function exportBoardToServer(): Promise<{ imported: boolean }> {
  if (!API_BASE) throw new Error('VITE_API_BASE가 설정되지 않았습니다.')
  const s = useBoardStore.getState()
  const res = await fetch(`${API_BASE}/api/boards/default`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workspaces: s.workspaces,
      edges: s.edges,
      pointer: s.pointer,
      checklistItems: s.checklistItems,
      snapshots: s.snapshots,
      boardLog: s.boardLog,
    }),
  })
  if (!res.ok) throw new Error(`서버 저장 실패: HTTP ${res.status}`)
  s.logBoard('보드 상태를 서버 DB로 저장')
  return res.json()
}
