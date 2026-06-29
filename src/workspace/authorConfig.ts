import type { NodeAuthor } from './types'

export interface AuthorConfig {
  label: string
  icon: string
  /** 노드 상단 액센트 바 색 */
  accentClass: string
  /** 탐색기·배지용 점 색 */
  dotClass: string
  chipClass: string
}

/**
 * 생성자별 시각 구분 (v2: 인간/AI 포스트잇 색상이 다르다).
 * 인간 = 중립(슬레이트), AI = 강조(인디고).
 */
export const AUTHOR_CONFIG: Record<NodeAuthor, AuthorConfig> = {
  human: {
    label: '나',
    icon: '👤',
    accentClass: 'bg-slate-300',
    dotClass: 'bg-slate-400',
    chipClass: 'bg-slate-100 text-slate-500',
  },
  ai: {
    label: 'AI',
    icon: '🤖',
    accentClass: 'bg-indigo-400',
    dotClass: 'bg-indigo-400',
    chipClass: 'bg-indigo-100 text-indigo-700',
  },
}

export const authorOf = (author: NodeAuthor | undefined): NodeAuthor => author ?? 'human'
