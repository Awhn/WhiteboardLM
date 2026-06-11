import { StubLLMClient } from './stubClient'
import { FallbackLLMClient, ServerLLMClient } from './serverClient'
import type { LLMClient } from './types'

let client: LLMClient | null = null

/**
 * VITE_API_BASE가 설정되면 서버 프록시(LiteLLM 멀티 프로바이더)를 사용하고,
 * 키 미설정(503)·서버 오류 시 스텁으로 폴백한다. 미설정이면 항상 스텁. [6gmRFCwh9C5CQRWc]
 */
export function getLLMClient(): LLMClient {
  if (!client) {
    const base = import.meta.env.VITE_API_BASE as string | undefined
    client = base
      ? new FallbackLLMClient(new ServerLLMClient(base), new StubLLMClient())
      : new StubLLMClient()
  }
  return client
}

export type {
  LLMClient,
  GenerateFieldsInput,
  GenerateChecklistInput,
  ExecuteItemInput,
} from './types'
