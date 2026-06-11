import type { WorkspaceType } from './types'

export interface WorkspaceTypeConfig {
  label: string
  icon: string
  description: string
  /** 포인터 직접 진입 가능 여부 — context 타입은 엣지로만 접근 */
  pointerEnterable: boolean
  headerClass: string
  badgeClass: string
  borderClass: string
}

export const WORKSPACE_TYPE_CONFIG: Record<WorkspaceType, WorkspaceTypeConfig> = {
  output: {
    label: '결과물',
    icon: '🎯',
    description: '최종 산출물을 만드는 작업공간',
    pointerEnterable: true,
    headerClass: 'bg-emerald-100 border-emerald-200',
    badgeClass: 'bg-emerald-200 text-emerald-800',
    borderClass: 'border-emerald-300',
  },
  context: {
    label: '컨텍스트',
    icon: '📚',
    description: '참고 자료 보관소. 엣지로만 연결되며 포인터 직접 진입 불가',
    pointerEnterable: false,
    headerClass: 'bg-violet-100 border-violet-200',
    badgeClass: 'bg-violet-200 text-violet-800',
    borderClass: 'border-violet-300',
  },
  intermediate: {
    label: '중간 작업',
    icon: '⚙️',
    description: '결과물로 가는 중간 단계 작업공간',
    pointerEnterable: true,
    headerClass: 'bg-amber-100 border-amber-200',
    badgeClass: 'bg-amber-200 text-amber-800',
    borderClass: 'border-amber-300',
  },
}

export const WORKSPACE_TYPES = Object.keys(WORKSPACE_TYPE_CONFIG) as WorkspaceType[]

export const canPointerEnter = (type: WorkspaceType): boolean =>
  WORKSPACE_TYPE_CONFIG[type].pointerEnterable
