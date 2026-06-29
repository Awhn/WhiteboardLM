/** 작업공간 타입: 무엇을 만들 것인가에 대한 역할 구분 */
export type WorkspaceType = 'output' | 'context' | 'intermediate'

export type DynamicFieldType = 'text' | 'select' | 'multiline' | 'number'

/** 선언형 정의의 동적 필드 — 목적 입력 후 LLM이 자동 생성 (M4) */
export interface DynamicField {
  id: string
  label: string
  type: DynamicFieldType
  options?: string[]
  value: string
}

/** 선언형 정의: "무엇을 만들 것인가" */
export interface Declaration {
  purpose: string
  dynamicFields: DynamicField[]
}

/** 작업공간 콘텐츠 형식 — 마크다운(기본) 또는 일반 텍스트 */
export type ContentFormat = 'markdown' | 'plain'

/**
 * 노드 카인드 — 노드 본문이 "무엇이고 어떻게 동작하는가" (type과 직교).
 * - declarative: 선언형 정의→체크리스트→포인터 실행에 참여하는 에이전트 노드
 * - note: 사용자가 직접 쓰는 마크다운/텍스트 문서
 * - file: 외부 가져온 파일 (뷰어)
 * - code: 코드 에디터
 * - web: 웹 임베드
 */
export type NodeKind = 'declarative' | 'note' | 'file' | 'code' | 'web'

/** 생성 주체 — 인간/AI 구분 (색상·편집 권한의 기준, v2) */
export type NodeAuthor = 'human' | 'ai'

export interface Workspace {
  id: string
  name: string
  /** 생성 주체. 인간 노드는 AI가 수정 불가, AI 노드는 사용자·에이전트 모두 수정 가능 */
  author?: NodeAuthor
  /** 묵시적 파생 관계 (내부용, 캔버스에 엣지로 표시하지 않음) */
  derivedFrom?: string[]
  /** 에이전트 그래프에서의 역할 (포인터 진입·엣지 의미론·권한) */
  type: WorkspaceType
  /** 본문 표면·동작 (kind 레지스트리가 해석). 생략 시 attachment 유무로 유도 */
  kind?: NodeKind
  /** 카인드별 부가 데이터 (code: { language }, web: { url } 등) */
  kindData?: Record<string, unknown>
  declaration: Declaration
  content: string
  /** 생략 시 markdown으로 취급 */
  contentFormat?: ContentFormat
  position: { x: number; y: number }
  size: { width: number; height: number }
  /** context 타입 전용: 포인터의 읽기 접근 허용 여부 (M14 [permission]) */
  accessGranted?: boolean
  /** 외부에서 가져온 파일 (있으면 본문에 파일 뷰어를 표시) */
  attachment?: import('../files/types').FileAttachment
}
