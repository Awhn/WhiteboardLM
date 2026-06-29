import type { DynamicField, DynamicFieldType } from '../workspace/types'
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

const DEFAULT_FIELDS = (): DynamicField[] => [
  field('대상 독자', 'text'),
  field('출력 포맷', 'select', ['마크다운 문서', '슬라이드 개요', '코드', '표/데이터']),
  field('포함해야 할 핵심 내용', 'multiline'),
]

const DEFAULT_CHECKLIST = (purpose: string): string[] => [
  `[AI] "${purpose.slice(0, 24)}" 관련 자료 정리`,
  '[AI] 구조 설계',
  '[AI] 초안 작성',
  '[승인] 결과 검토',
]

/**
 * API 키 없이 v2 흐름을 개발·테스트하기 위한 스텁.
 * 미션(purpose)에 따라 그럴듯한 결과를 결정적으로 반환한다.
 * 입력에 "!error"가 포함되면 의도적으로 실패한다 — 오류 폴백 테스트용 훅.
 */
export class StubLLMClient implements LLMClient {
  async proposeMission({ fallback }: { fallback: string }): Promise<string> {
    await delay(300)
    return fallback
  }

  async generateDynamicFields({ purpose }: GenerateFieldsInput): Promise<DynamicField[]> {
    await delay(600)
    if (purpose.includes('!error')) {
      throw new Error('스텁 오류 훅: 목적에 "!error"가 포함되어 있습니다.')
    }
    return DEFAULT_FIELDS()
  }

  async generateChecklist({ purpose }: GenerateChecklistInput): Promise<string[]> {
    await delay(800)
    if (purpose.includes('!error')) {
      throw new Error('스텁 오류 훅: 목적에 "!error"가 포함되어 있습니다.')
    }
    return DEFAULT_CHECKLIST(purpose)
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
