import type { NodeKind, Workspace } from '../types'
import { ContentBody, FileBody } from './bodies'
import { CodeBody } from './CodeBody'
import { WebBody } from './WebBody'
import type { NodeKindDefinition } from './types'

/**
 * 노드 카인드 레지스트리. 새 카인드 = 정의 추가 + 이 배열에 한 줄.
 */
export const NODE_KINDS: NodeKindDefinition[] = [
  {
    id: 'note',
    label: '노트',
    icon: '📝',
    description: '직접 작성하는 마크다운/텍스트 Post-it',
    defaultType: 'context',
    declarative: false,
    editable: true,
    usesEditToggle: true,
    getContextText: (ws) => (ws.content ? `[노트 내용]\n${ws.content}` : null),
    Body: ContentBody,
  },
  {
    id: 'code',
    label: '코드',
    icon: '💻',
    description: '코드 에디터 (언어 선택)',
    defaultType: 'context',
    declarative: false,
    editable: true,
    usesEditToggle: false,
    getContextText: (ws) => {
      const lang = (ws.kindData?.language as string) ?? 'text'
      return ws.content ? `[코드 ${lang}]\n\`\`\`${lang}\n${ws.content}\n\`\`\`` : null
    },
    Body: CodeBody,
    createInitial: () => ({ kindData: { language: 'python' }, contentFormat: 'plain' }),
  },
  {
    id: 'web',
    label: '웹',
    icon: '🌐',
    description: '웹 페이지 임베드 (URL)',
    defaultType: 'context',
    declarative: false,
    editable: false,
    usesEditToggle: false,
    getContextText: (ws) => {
      const url = ws.kindData?.url as string | undefined
      return url ? `[웹 임베드] ${ws.name}: ${url}` : null
    },
    Body: WebBody,
    createInitial: () => ({ kindData: { url: '' } }),
  },
  {
    id: 'file',
    label: '파일',
    icon: '📎',
    description: '외부에서 가져온 파일 (뷰어 표시)',
    defaultType: 'context',
    declarative: false,
    editable: false,
    usesEditToggle: false,
    getContextText: (ws) =>
      ws.attachment ? `[전체 내용 — 첨부 파일]\n${ws.attachment.textContent}` : null,
    Body: FileBody,
  },
]

const DEFAULT_KIND = NODE_KINDS[0]

/** 사용자가 캔버스에서 직접 만들 수 있는 카인드 (파일은 📎 임포트로만 생성) */
export const CREATABLE_KINDS = NODE_KINDS.filter((k) => k.id !== 'file')

/** 저장 데이터에 kind가 없으면 attachment 유무로 유도. declarative는 note로 강등(v2) */
export function resolveKind(ws: Pick<Workspace, 'kind' | 'attachment'>): NodeKind {
  const k = ws.kind ?? (ws.attachment ? 'file' : 'note')
  return k === 'declarative' ? 'note' : k
}

export function getKind(id: NodeKind | undefined): NodeKindDefinition {
  return NODE_KINDS.find((k) => k.id === id) ?? DEFAULT_KIND
}

/** 워크스페이스의 실제 카인드 정의 (kind 미설정 시 유도) */
export function kindOf(ws: Pick<Workspace, 'kind' | 'attachment'>): NodeKindDefinition {
  return getKind(resolveKind(ws))
}
