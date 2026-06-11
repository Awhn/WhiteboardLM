/**
 * 엣지 타입 의미론 — 포인터가 연결된 노드에 대해 무엇을 하는가:
 * - reference: 선언형 정의만 컨텍스트에 로드
 * - source: 전체 내용 로드
 * - update: 작업 결과를 대상 작업공간에 기록
 * - validate: 결과 검증용 연결
 */
export type EdgeType = 'reference' | 'source' | 'update' | 'validate'

export interface WorkspaceEdge {
  id: string
  source: string
  target: string
  type: EdgeType
  /** 컨텍스트가 이 엣지를 통해 전파되는 최대 단계 (1 또는 2) */
  hopLimit: 1 | 2
  /** [권한] 예외 처리에서 "엣지 비활성화"를 선택하면 true — 컨텍스트 로딩에서 제외 */
  disabled?: boolean
}
