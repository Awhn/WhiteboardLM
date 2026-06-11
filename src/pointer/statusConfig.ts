import type { PointerStatus } from './types'

export interface PointerStatusConfig {
  icon: string
  label: string
  /** 진행 중 상태는 배지에 펄스 애니메이션을 준다 */
  active: boolean
}

export const POINTER_STATUS_CONFIG: Record<PointerStatus, PointerStatusConfig> = {
  thinking: { icon: '🌀', label: '생각 중', active: true },
  planning: { icon: '📋', label: '계획 중', active: true },
  working: { icon: '✏️', label: '작업 중', active: true },
  tool_use: { icon: '🔧', label: '도구 사용 중', active: true },
  waiting: { icon: '⏸️', label: '대기 중', active: false },
  done: { icon: '✅', label: '완료', active: false },
}
