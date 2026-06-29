import { StubLLMClient } from './stubClient'
import { ServerLLMClient } from './serverClient'
import { BrowserLLMClient } from './browserClient'
import { getLLMConfig } from './config'
import type {
  ExecuteItemInput,
  GenerateChecklistInput,
  GenerateFieldsInput,
  LLMClient,
  ProposeMissionInput,
} from './types'

/**
 * 설정에 따라 매 호출 시 클라이언트를 선택한다:
 * - 로컬 모드 ON: 브라우저에서 프로바이더 직접 호출 (BrowserLLMClient)
 * - 로컬 모드 OFF: 백엔드 프록시 (ServerLLMClient)
 * 어느 쪽이든 실패하면 스텁으로 폴백한다. [6gmRFCwh9C5CQRWc]
 */
class RoutingLLMClient implements LLMClient {
  private browser = new BrowserLLMClient()
  private server = new ServerLLMClient()
  private stub = new StubLLMClient()

  private async route<T>(fn: (c: LLMClient) => Promise<T>): Promise<T> {
    const primary = getLLMConfig().localMode ? this.browser : this.server
    try {
      return await fn(primary)
    } catch (e) {
      console.warn('[llm] 호출 실패 — 스텁으로 폴백:', e)
      return fn(this.stub)
    }
  }

  proposeMission(input: ProposeMissionInput) {
    return this.route((c) => c.proposeMission(input))
  }
  generateDynamicFields(input: GenerateFieldsInput) {
    return this.route((c) => c.generateDynamicFields(input))
  }
  generateChecklist(input: GenerateChecklistInput) {
    return this.route((c) => c.generateChecklist(input))
  }
  executeChecklistItem(input: ExecuteItemInput) {
    return this.route((c) => c.executeChecklistItem(input))
  }
}

let client: LLMClient | null = null

export function getLLMClient(): LLMClient {
  client ??= new RoutingLLMClient()
  return client
}

export type {
  LLMClient,
  GenerateFieldsInput,
  GenerateChecklistInput,
  ExecuteItemInput,
} from './types'
