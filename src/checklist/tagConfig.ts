import type { ChecklistTag } from './types'

export interface ChecklistTagConfig {
  label: string
  chipClass: string
}

export const CHECKLIST_TAG_CONFIG: Record<ChecklistTag, ChecklistTagConfig> = {
  AI: { label: 'AI', chipClass: 'bg-blue-100 text-blue-700' },
  human: { label: '인간', chipClass: 'bg-pink-100 text-pink-700' },
  approval: { label: '승인', chipClass: 'bg-purple-100 text-purple-700' },
  blocking: { label: '블로킹', chipClass: 'bg-red-100 text-red-700' },
  permission: { label: '권한', chipClass: 'bg-orange-100 text-orange-700' },
}
