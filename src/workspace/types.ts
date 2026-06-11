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

export interface Workspace {
  id: string
  name: string
  type: WorkspaceType
  declaration: Declaration
  content: string
  /** 생략 시 markdown으로 취급 */
  contentFormat?: ContentFormat
  position: { x: number; y: number }
  size: { width: number; height: number }
  /** context 타입 전용: 포인터의 읽기 접근 허용 여부 (M14 [permission]) */
  accessGranted?: boolean
}
