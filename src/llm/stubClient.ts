import type { DynamicField, DynamicFieldType, WorkspaceType } from '../workspace/types'
import type { GenerateFieldsInput, LLMClient } from './types'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

let fieldCounter = 0
const field = (
  label: string,
  type: DynamicFieldType,
  options?: string[],
): DynamicField => ({
  id: `field-${Date.now().toString(36)}-${(fieldCounter++).toString(36)}`,
  label,
  type,
  options,
  value: '',
})

const FIELDS_BY_TYPE: Record<WorkspaceType, () => DynamicField[]> = {
  output: () => [
    field('대상 독자', 'text'),
    field('출력 포맷', 'select', ['마크다운 문서', '슬라이드 개요', '코드', '표/데이터']),
    field('분량(단어 수)', 'number'),
    field('포함해야 할 핵심 내용', 'multiline'),
  ],
  context: () => [
    field('자료 출처 유형', 'select', ['웹 문서', '내부 문서', '데이터셋', '코드베이스']),
    field('핵심 키워드', 'text'),
    field('자료 요약', 'multiline'),
  ],
  intermediate: () => [
    field('입력으로 받는 것', 'text'),
    field('출력으로 넘기는 것', 'text'),
    field('처리 방식', 'select', ['요약', '변환', '검증', '분석']),
    field('주의사항', 'multiline'),
  ],
}

/**
 * API 키 없이 M4~M5 흐름을 개발·테스트하기 위한 스텁.
 * 작업공간 타입에 따라 그럴듯한 동적 필드를 결정적으로 반환한다.
 * 목적에 "!error"가 포함되면 의도적으로 실패한다 — 오류 폴백 UI 테스트용 훅.
 */
export class StubLLMClient implements LLMClient {
  async generateDynamicFields({ type, purpose }: GenerateFieldsInput): Promise<DynamicField[]> {
    await delay(600)
    if (purpose.includes('!error')) {
      throw new Error('스텁 오류 훅: 목적에 "!error"가 포함되어 있습니다.')
    }
    return FIELDS_BY_TYPE[type]()
  }
}
