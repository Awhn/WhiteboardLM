import type { EdgeType } from '../edge/types'
import type { Declaration, DynamicField, DynamicFieldType, Workspace, WorkspaceType } from './types'

let fieldCounter = 0
const field = (
  label: string,
  type: DynamicFieldType,
  value: string,
  options?: string[],
): DynamicField => ({
  id: `tplf-${Date.now().toString(36)}-${(fieldCounter++).toString(36)}`,
  label,
  type,
  options,
  value,
})

/**
 * 엣지 드래그로 생성하는 사전 정의 작업공간 템플릿.
 * build()는 "정의 완료" 상태의 선언(목적 + 값이 채워진 동적 필드)을 만들어
 * 생성 즉시 체크리스트 생성 → 포인터 실행이 가능하게 한다.
 */
export interface WorkspaceTemplate {
  id: string
  icon: string
  label: string
  description: string
  /** 소스 → 새 작업공간 엣지 타입 */
  edgeType: EdgeType
  /** 소스 작업공간의 정의에 맞는 템플릿만 노출 */
  appliesTo?: (source: Workspace) => boolean
  build: (source: Workspace) => {
    name: string
    type: WorkspaceType
    declaration: Declaration
  }
}

const hasContent = (ws: Workspace) => ws.content.trim().length > 0 || Boolean(ws.attachment)

export const WORKSPACE_TEMPLATES: WorkspaceTemplate[] = [
  {
    id: 'summary',
    icon: '📝',
    label: '요약',
    description: '연결된 내용의 핵심을 추려 요약합니다',
    edgeType: 'source',
    build: (source) => ({
      name: `요약: ${source.name}`,
      type: 'output',
      declaration: {
        purpose: `「${source.name}」의 내용을 핵심 위주로 요약`,
        dynamicFields: [
          field('분량', 'select', '1단락', ['3줄', '1단락', '1페이지']),
          field('대상 독자', 'text', '일반 팀원'),
        ],
      },
    }),
  },
  {
    id: 'critique',
    icon: '🧐',
    label: '비판·리뷰',
    description: '논리적 허점과 개선점을 짚어 리뷰합니다',
    edgeType: 'source',
    appliesTo: hasContent,
    build: (source) => ({
      name: `리뷰: ${source.name}`,
      type: 'intermediate',
      declaration: {
        purpose: `「${source.name}」 내용에 대한 비판적 검토와 개선 제안`,
        dynamicFields: [
          field('검토 관점', 'select', '논리적 일관성', [
            '논리적 일관성',
            '근거의 충실성',
            '실행 가능성',
          ]),
          field('피드백 어조', 'text', '직설적이되 건설적으로'),
        ],
      },
    }),
  },
  {
    id: 'visualize',
    icon: '📈',
    label: '시각화',
    description: '데이터·구조를 차트나 다이어그램으로 표현합니다',
    edgeType: 'source',
    appliesTo: (source) => source.attachment?.handlerId === 'csv' || hasContent(source),
    build: (source) => ({
      name: `시각화: ${source.name}`,
      type: 'output',
      declaration: {
        purpose: `「${source.name}」의 데이터/구조를 시각 자료로 표현`,
        dynamicFields: [
          field('형식', 'select', '차트', ['차트', '다이어그램', '표']),
          field('강조할 포인트', 'text', '추세와 이상치'),
        ],
      },
    }),
  },
  {
    id: 'checklist-gen',
    icon: '✅',
    label: '체크리스트 도출',
    description: '내용에서 실행 항목을 뽑아 실행 계획을 만듭니다',
    edgeType: 'source',
    build: (source) => ({
      name: `실행 계획: ${source.name}`,
      type: 'intermediate',
      declaration: {
        purpose: `「${source.name}」에서 실행 가능한 작업 항목을 도출해 실행 계획 수립`,
        dynamicFields: [
          field('우선순위 기준', 'select', '임팩트', ['임팩트', '긴급도', '난이도']),
          field('기한 가정', 'text', '2주 스프린트'),
        ],
      },
    }),
  },
  {
    id: 'transcript',
    icon: '🎙️',
    label: 'Transcript 정리',
    description: '원문을 발화·항목 단위로 구조화해 정리합니다',
    edgeType: 'source',
    appliesTo: (source) => Boolean(source.attachment) || source.type === 'context',
    build: (source) => ({
      name: `Transcript: ${source.name}`,
      type: 'output',
      declaration: {
        purpose: `「${source.name}」 원문을 구조화된 트랜스크립트로 정리`,
        dynamicFields: [
          field('구조', 'select', '주제별', ['주제별', '시간순', '화자별']),
          field('포함 요소', 'text', '핵심 발언, 결정 사항, 액션 아이템'),
        ],
      },
    }),
  },
]

/** 소스 작업공간의 정의에 맞는 템플릿 목록 (없으면 전체 폴백) */
export function templatesForSource(source: Workspace): WorkspaceTemplate[] {
  const applicable = WORKSPACE_TEMPLATES.filter((t) => t.appliesTo?.(source) ?? true)
  return applicable.length > 0 ? applicable : WORKSPACE_TEMPLATES
}
