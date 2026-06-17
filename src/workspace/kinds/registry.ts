import type { NodeKind, Workspace } from '../types'
import { ContentBody, FileBody } from './bodies'
import type { NodeKindDefinition } from './types'

/**
 * 노드 카인드 레지스트리. 새 카인드 = 정의 추가 + 이 배열에 한 줄.
 * (M24에서 note·code·web 카인드가 여기에 등록된다)
 */
export const NODE_KINDS: NodeKindDefinition[] = [
  {
    id: 'declarative',
    label: '선언형 작업',
    icon: '🧠',
    description: '목적을 선언하면 AI가 체크리스트로 실행하는 작업공간',
    defaultType: 'intermediate',
    declarative: true,
    editable: true,
    getContextText: (ws) => (ws.content ? `[전체 내용]\n${ws.content}` : null),
    Body: ContentBody,
  },
  {
    id: 'file',
    label: '파일',
    icon: '📎',
    description: '외부에서 가져온 파일 (뷰어 표시)',
    defaultType: 'context',
    declarative: false,
    editable: false,
    getContextText: (ws) =>
      ws.attachment ? `[전체 내용 — 첨부 파일]\n${ws.attachment.textContent}` : null,
    Body: FileBody,
  },
]

const DEFAULT_KIND = NODE_KINDS[0]

/** 저장 데이터에 kind가 없으면 attachment 유무로 유도 (마이그레이션 호환) */
export function resolveKind(ws: Pick<Workspace, 'kind' | 'attachment'>): NodeKind {
  return ws.kind ?? (ws.attachment ? 'file' : 'declarative')
}

export function getKind(id: NodeKind | undefined): NodeKindDefinition {
  return NODE_KINDS.find((k) => k.id === id) ?? DEFAULT_KIND
}

/** 워크스페이스의 실제 카인드 정의 (kind 미설정 시 유도) */
export function kindOf(ws: Pick<Workspace, 'kind' | 'attachment'>): NodeKindDefinition {
  return getKind(resolveKind(ws))
}
