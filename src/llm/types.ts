import type { DynamicField, WorkspaceType } from '../workspace/types'

export interface GenerateFieldsInput {
  name: string
  type: WorkspaceType
  purpose: string
}

export interface GenerateChecklistInput {
  name: string
  type: WorkspaceType
  purpose: string
  dynamicFields: DynamicField[]
}

export interface ExecuteItemInput {
  title: string
  workspaceName: string
  purpose: string
  /** 반려 재작업 시 사용자 코멘트 (M7) */
  comment?: string
}

/**
 * LLM 호출 추상화. 프로토타입 단계에서는 StubLLMClient를 사용하고,
 * API 키가 준비되면 동일 인터페이스의 Anthropic 클라이언트로 교체한다.
 * (Phase 2 M15에서 서버사이드 프록시로 이전 예정)
 */
export interface LLMClient {
  /** 목적 요약으로부터 선언형 정의의 동적 필드 목록을 생성 (M4) */
  generateDynamicFields(input: GenerateFieldsInput): Promise<DynamicField[]>
  /** 완료된 선언형 정의로부터 "[태그] 제목" 형식의 체크리스트 라인을 생성 (M5) */
  generateChecklist(input: GenerateChecklistInput): Promise<string[]>
  /** [AI] 체크리스트 항목을 실행하고 작업공간에 기록할 결과 텍스트를 반환 (M6) */
  executeChecklistItem(input: ExecuteItemInput): Promise<string>
}
