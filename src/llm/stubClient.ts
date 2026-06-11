import type { DynamicField, DynamicFieldType, WorkspaceType } from '../workspace/types'
import { BlockedError } from './errors'
import type {
  ExecuteItemInput,
  GenerateChecklistInput,
  GenerateFieldsInput,
  LLMClient,
} from './types'

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

const CHECKLIST_BY_TYPE: Record<WorkspaceType, (purpose: string) => string[]> = {
  output: (purpose) => [
    `[AI] "${purpose.slice(0, 24)}" 관련 자료 정리`,
    '[AI] 구조(목차) 설계',
    '[AI] 초안 작성',
    '[인간] 초안 검토 및 세부 내용 보강',
    '[승인] 최종 결과물 승인',
  ],
  context: () => [
    '[AI] 자료 출처 목록화',
    '[AI] 핵심 내용 요약 정리',
    '[승인] 컨텍스트 자료 확정',
  ],
  intermediate: (purpose) => [
    `[AI] 입력 데이터 확인 — ${purpose.slice(0, 24)}`,
    '[AI] 변환/처리 수행',
    '[AI] 결과 자체 검증',
    '[승인] 다음 단계 전달 승인',
  ],
}

/**
 * API 키 없이 M4~M6 흐름을 개발·테스트하기 위한 스텁.
 * 작업공간 타입에 따라 그럴듯한 결과를 결정적으로 반환한다.
 * 입력에 "!error"가 포함되면 의도적으로 실패한다 — 오류 폴백 UI 테스트용 훅.
 */
export class StubLLMClient implements LLMClient {
  async generateDynamicFields({ type, purpose }: GenerateFieldsInput): Promise<DynamicField[]> {
    await delay(600)
    if (purpose.includes('!error')) {
      throw new Error('스텁 오류 훅: 목적에 "!error"가 포함되어 있습니다.')
    }
    return FIELDS_BY_TYPE[type]()
  }

  async generateChecklist({ type, purpose }: GenerateChecklistInput): Promise<string[]> {
    await delay(800)
    if (purpose.includes('!error')) {
      throw new Error('스텁 오류 훅: 목적에 "!error"가 포함되어 있습니다.')
    }
    return CHECKLIST_BY_TYPE[type](purpose)
  }

  async executeChecklistItem({
    title,
    purpose,
    comment,
    context,
    toolResult,
    blockResolved,
  }: ExecuteItemInput): Promise<string> {
    await delay(700)
    if (title.includes('!error')) {
      throw new Error('스텁 오류 훅: 항목 제목에 "!error"가 포함되어 있습니다.')
    }
    // M13 테스트 훅: "!block" 항목은 블로킹 예외가 해소되기 전까지 판단 불가
    if (title.includes('!block') && !blockResolved) {
      throw new BlockedError('스텁 블로킹 훅: 추가 정보 없이 진행 방향을 판단할 수 없습니다.')
    }
    const rework = comment ? ` (반려 코멘트 반영: ${comment})` : ''
    const tool = toolResult ? `\n\n> 도구 결과: ${toolResult}` : ''
    const ctx = context ? `\n\n> 참조 컨텍스트:\n${context.slice(0, 400)}` : ''
    return `### ${title}\n\n「${purpose}」 목적에 따라 위 단계를 수행한 결과입니다${rework}. — 스텁 출력${tool}${ctx}`
  }
}
