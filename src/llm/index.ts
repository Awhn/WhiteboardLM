import { StubLLMClient } from './stubClient'
import { FallbackLLMClient, ServerLLMClient } from './serverClient'
import type { LLMClient } from './types'

let client: LLMClient | null = null

/**
 * 항상 서버→스텁 폴백 클라이언트를 사용한다.
 * ServerLLMClient가 설정(apiBase/model/apiKey)을 요청 시점에 읽으므로,
 * 설정 패널에서 백엔드 주소·키를 입력하면 즉시 반영된다.
 * apiBase 미설정 또는 키 미설정(503)·오류 시 스텁으로 폴백. [6gmRFCwh9C5CQRWc]
 */
export function getLLMClient(): LLMClient {
  client ??= new FallbackLLMClient(new ServerLLMClient(), new StubLLMClient())
  return client
}

export type {
  LLMClient,
  GenerateFieldsInput,
  GenerateChecklistInput,
  ExecuteItemInput,
} from './types'
