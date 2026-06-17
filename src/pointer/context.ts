import type { Workspace } from '../workspace/types'
import { kindOf } from '../workspace/kinds/registry'
import type { WorkspaceEdge } from '../edge/types'
import { EDGE_TYPE_CONFIG } from '../edge/edgeConfig'

export interface ContextPart {
  workspaceId: string
  name: string
  edgeType: WorkspaceEdge['type']
  hop: 1 | 2
  /** 로딩 규칙에 따라 구성된 컨텍스트 본문 */
  detail: string
}

export interface PointerContext {
  parts: ContextPart[]
  /** LLM 프롬프트에 넣을 직렬화 텍스트 */
  text: string
  /** update 엣지로 결과가 흘러갈 대상 작업공간 id 목록 */
  updateTargets: string[]
  /** 접근 권한이 없어 로드하지 못한 context 타입 작업공간 (M14 [permission] 트리거) */
  permissionNeeded: { workspaceId: string; name: string; edgeIds: string[] }[]
}

const declarationSummary = (ws: Workspace): string => {
  const fields = ws.declaration.dynamicFields
    .filter((f) => f.value.trim())
    .map((f) => `${f.label}: ${f.value}`)
    .join(', ')
  return `목적: ${ws.declaration.purpose || '(미정의)'}${fields ? ` / ${fields}` : ''}`
}

/** 엣지 타입별 로딩 규칙 (M11) */
const loadDetail = (edgeType: WorkspaceEdge['type'], ws: Workspace): string => {
  switch (edgeType) {
    case 'source': {
      // source: 전체 내용 로드 — 카인드가 자신의 컨텍스트 텍스트 형식을 소유 (M11)
      return kindOf(ws).getContextText?.(ws) ?? '[전체 내용] (비어 있음)'
    }
    case 'reference':
      // reference: 선언형 정의만 로드. 필요 시 내용 추가 요청 가능 표시
      return `[정의만 로드] ${declarationSummary(ws)} (필요 시 내용 추가 요청 가능)`
    case 'validate':
      return `[검증 대상] ${declarationSummary(ws)}`
    case 'update':
      return `[결과 기록 대상] ${declarationSummary(ws)}`
  }
}

/**
 * 포인터 위치 기준으로 연결된 노드의 컨텍스트를 수집한다.
 * - 1-hop: 엣지 타입 규칙대로 로드
 * - 엣지의 hopLimit이 2면 그 노드의 이웃까지 한 단계 더 (토큰 절약을 위해 정의만)
 * - 비활성화된 엣지는 제외
 * - context 타입 + 접근 미허용 노드는 로드하지 않고 permissionNeeded로 보고
 */
export function buildPointerContext(
  workspaceId: string,
  workspaces: Workspace[],
  edges: WorkspaceEdge[],
): PointerContext {
  const byId = new Map(workspaces.map((w) => [w.id, w]))
  const parts: ContextPart[] = []
  const updateTargets: string[] = []
  const permissionNeeded = new Map<string, { workspaceId: string; name: string; edgeIds: string[] }>()
  const visited = new Set<string>([workspaceId])

  const incident = (id: string) =>
    edges.filter((e) => !e.disabled && (e.source === id || e.target === id))

  for (const edge of incident(workspaceId)) {
    const otherId = edge.source === workspaceId ? edge.target : edge.source
    const other = byId.get(otherId)
    if (!other || visited.has(otherId)) continue

    // 포인터가 ws에서 출발하는 update 엣지: 읽기가 아니라 쓰기 경로
    if (edge.type === 'update' && edge.source === workspaceId) {
      updateTargets.push(otherId)
      visited.add(otherId)
      parts.push({
        workspaceId: otherId,
        name: other.name,
        edgeType: edge.type,
        hop: 1,
        detail: loadDetail('update', other),
      })
      continue
    }

    // context 타입 작업공간: 권한 체크 (M14)
    if (other.type === 'context' && !other.accessGranted) {
      const entry = permissionNeeded.get(otherId) ?? {
        workspaceId: otherId,
        name: other.name,
        edgeIds: [],
      }
      entry.edgeIds.push(edge.id)
      permissionNeeded.set(otherId, entry)
      continue
    }

    visited.add(otherId)
    parts.push({
      workspaceId: otherId,
      name: other.name,
      edgeType: edge.type,
      hop: 1,
      detail: loadDetail(edge.type, other),
    })

    // 2-hop 확장: 정의만 로드해 토큰을 절약
    if (edge.hopLimit === 2) {
      for (const e2 of incident(otherId)) {
        const thirdId = e2.source === otherId ? e2.target : e2.source
        const third = byId.get(thirdId)
        if (!third || visited.has(thirdId)) continue
        if (third.type === 'context' && !third.accessGranted) continue
        visited.add(thirdId)
        parts.push({
          workspaceId: thirdId,
          name: third.name,
          edgeType: e2.type,
          hop: 2,
          detail: `[2-hop 정의] ${declarationSummary(third)}`,
        })
      }
    }
  }

  const text = parts
    .map((p) => {
      const cfg = EDGE_TYPE_CONFIG[p.edgeType]
      return `${cfg.icon} ${p.name} (${cfg.label}, ${p.hop}-hop)\n${p.detail}`
    })
    .join('\n\n')

  return { parts, text, updateTargets, permissionNeeded: [...permissionNeeded.values()] }
}
