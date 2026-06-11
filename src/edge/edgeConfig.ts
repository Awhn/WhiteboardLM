import type { EdgeType } from './types'

export interface EdgeTypeConfig {
  label: string
  icon: string
  description: string
  stroke: string
  strokeWidth: number
  /** SVG strokeDasharray — 실선이면 undefined */
  dash?: string
  animated?: boolean
}

export const EDGE_TYPE_CONFIG: Record<EdgeType, EdgeTypeConfig> = {
  reference: {
    label: '참조',
    icon: '📖',
    description: '선언형 정의만 컨텍스트에 로드. 필요 시 내용 추가 요청',
    stroke: '#94a3b8',
    strokeWidth: 1.5,
    dash: '6 4',
  },
  source: {
    label: '소스',
    icon: '📥',
    description: '연결된 노드의 전체 내용을 컨텍스트에 로드',
    stroke: '#3b82f6',
    strokeWidth: 2,
  },
  update: {
    label: '업데이트',
    icon: '✏️',
    description: '작업 결과를 대상 작업공간에 기록 (포인터 자율 이동 경로)',
    stroke: '#10b981',
    strokeWidth: 2.5,
    animated: true,
  },
  validate: {
    label: '검증',
    icon: '✅',
    description: '결과 검증용 연결',
    stroke: '#8b5cf6',
    strokeWidth: 1.5,
    dash: '2 3',
  },
}

export const EDGE_TYPES = Object.keys(EDGE_TYPE_CONFIG) as EdgeType[]
