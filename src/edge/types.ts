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
  hopLimit: 1 | 2
}
