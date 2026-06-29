import type { Workspace } from '../workspace/types'
import { kindOf } from '../workspace/kinds/registry'

export interface ContextPart {
  workspaceId: string
  name: string
  distance: number
  /** 직접 파생 관계면 우선순위가 높다 */
  derived: boolean
  detail: string
}

export interface PointerContext {
  parts: ContextPart[]
  /** LLM 프롬프트에 넣을 직렬화 텍스트 */
  text: string
}

/** 공간 컨텍스트 수집 파라미터 (AI가 동적으로 반경을 넓히는 것을 근사) */
const DEFAULT_NEAR = 4 // 1차 반경에서 우선 채택할 이웃 수
const MIN_NEIGHBORS = 2 // 이보다 적으면 반경 확장
const BASE_RADIUS = 520 // 1차 반경(px)
const EXPANDED_RADIUS = 1100 // 확장 반경

const center = (w: Workspace) => ({
  x: w.position.x + w.size.width / 2,
  y: w.position.y + w.size.height / 2,
})

const dist = (a: Workspace, b: Workspace) => {
  const ca = center(a)
  const cb = center(b)
  return Math.hypot(ca.x - cb.x, ca.y - cb.y)
}

/**
 * 포인터(에이전트) 위치를 중심으로 공간 근접성 기반 컨텍스트를 수집한다 (v2).
 * - 명시적 엣지가 아니라 거리로 "Relevant Neighborhood"를 결정
 * - 가까운 노드 우선, 이웃이 적으면 반경을 동적으로 확장
 * - derivedFrom(묵시적 파생) 노드는 거리와 무관하게 포함·우선
 */
export function buildSpatialContext(
  workspaceId: string,
  workspaces: Workspace[],
): PointerContext {
  const origin = workspaces.find((w) => w.id === workspaceId)
  if (!origin) return { parts: [], text: '' }

  const derivedSet = new Set(origin.derivedFrom ?? [])
  const others = workspaces.filter((w) => w.id !== workspaceId)

  const scored = others
    .map((w) => ({ w, d: dist(origin, w), derived: derivedSet.has(w.id) }))
    .sort((a, b) => a.d - b.d)

  // 1차 반경 내 가까운 이웃 + 파생 노드는 항상 포함
  let picked = scored.filter((s) => s.derived || s.d <= BASE_RADIUS).slice(0, DEFAULT_NEAR + derivedSet.size)
  // 이웃이 너무 적으면 반경 확장 (AI가 탐색 범위를 넓히는 동작의 근사)
  if (picked.filter((s) => !s.derived).length < MIN_NEIGHBORS) {
    picked = scored
      .filter((s) => s.derived || s.d <= EXPANDED_RADIUS)
      .slice(0, DEFAULT_NEAR + derivedSet.size)
  }

  const parts: ContextPart[] = picked.map(({ w, d, derived }) => ({
    workspaceId: w.id,
    name: w.name,
    distance: Math.round(d),
    derived,
    detail: kindOf(w).getContextText?.(w) ?? `[빈 노드] ${w.name}`,
  }))

  const text = parts
    .map((p) => {
      const tag = p.derived ? '🔗 파생' : `📍 근접(${p.distance}px)`
      return `${tag} ${p.name}\n${p.detail}`
    })
    .join('\n\n')

  return { parts, text }
}
