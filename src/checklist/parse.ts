import type { ChecklistTag } from './types'

const TAG_MAP: Record<string, ChecklistTag> = {
  AI: 'AI',
  인간: 'human',
  승인: 'approval',
  블로킹: 'blocking',
  권한: 'permission',
}

const LINE_PATTERN = /^\s*\[(AI|인간|승인|블로킹|권한)\]\s*(.+)$/

/**
 * LLM이 생성한 "[태그] 제목" 형식 라인을 파싱한다.
 * 태그가 없거나 알 수 없는 라인은 안전하게 [AI]로 폴백한다.
 */
export function parseChecklistLine(line: string): { tag: ChecklistTag; title: string } | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  const match = trimmed.match(LINE_PATTERN)
  if (!match) return { tag: 'AI', title: trimmed }
  return { tag: TAG_MAP[match[1]], title: match[2].trim() }
}

export function parseChecklistLines(lines: string[]): { tag: ChecklistTag; title: string }[] {
  return lines
    .map(parseChecklistLine)
    .filter((item): item is { tag: ChecklistTag; title: string } => item !== null)
}
