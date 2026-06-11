import { StubLLMClient } from './stubClient'
import type { LLMClient } from './types'

let client: LLMClient | null = null

/**
 * 현재는 항상 스텁을 반환한다. API 키(VITE_ANTHROPIC_API_KEY)가 준비되면
 * 여기에서 실제 Anthropic 클라이언트로 분기한다. [6gmRFCwh9C5CQRWc]
 */
export function getLLMClient(): LLMClient {
  client ??= new StubLLMClient()
  return client
}

export type { LLMClient, GenerateFieldsInput } from './types'
