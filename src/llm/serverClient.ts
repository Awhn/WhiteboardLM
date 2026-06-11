import type { DynamicField } from '../workspace/types'
import type {
  ExecuteItemInput,
  GenerateChecklistInput,
  GenerateFieldsInput,
  LLMClient,
} from './types'

/** 서버 프록시(LiteLLM)에 키가 없을 때 — 스텁 폴백 신호 */
export class ServerUnavailableError extends Error {}

let fieldCounter = 0

/** FastAPI 프록시(M15, LiteLLM 멀티 프로바이더) 경유 LLM 클라이언트 */
export class ServerLLMClient implements LLMClient {
  private readonly base: string

  constructor(base: string) {
    this.base = base
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.status === 503) {
      const detail = (await res.json().catch(() => null))?.detail
      throw new ServerUnavailableError(detail ?? 'LLM 프로바이더 키가 설정되지 않았습니다.')
    }
    if (!res.ok) throw new Error(`서버 LLM 오류: HTTP ${res.status}`)
    return res.json() as Promise<T>
  }

  async generateDynamicFields(input: GenerateFieldsInput): Promise<DynamicField[]> {
    const fields = await this.post<Partial<DynamicField>[]>('/api/llm/dynamic-fields', input)
    return fields.map((f) => ({
      id: f.id ?? `field-srv-${Date.now().toString(36)}-${(fieldCounter++).toString(36)}`,
      label: f.label ?? '필드',
      type: f.type ?? 'text',
      options: f.options ?? undefined,
      value: f.value ?? '',
    }))
  }

  generateChecklist(input: GenerateChecklistInput): Promise<string[]> {
    return this.post<string[]>('/api/llm/checklist', input)
  }

  async executeChecklistItem(input: ExecuteItemInput): Promise<string> {
    const { result, toolTrace } = await this.post<{
      result: string
      toolTrace: { tool: string; result: string }[]
    }>('/api/llm/execute', input)
    const trace =
      toolTrace && toolTrace.length > 0
        ? `\n\n> 🔧 서버 도구 사용: ${toolTrace.map((t) => t.tool).join(', ')}`
        : ''
    return result + trace
  }
}

/** 서버 호출 실패 시 스텁으로 폴백하는 래퍼 */
export class FallbackLLMClient implements LLMClient {
  private readonly primary: LLMClient
  private readonly fallback: LLMClient

  constructor(primary: LLMClient, fallback: LLMClient) {
    this.primary = primary
    this.fallback = fallback
  }

  private async withFallback<T>(call: (c: LLMClient) => Promise<T>): Promise<T> {
    try {
      return await call(this.primary)
    } catch (e) {
      console.warn('[llm] 서버 호출 실패 — 스텁으로 폴백:', e)
      return call(this.fallback)
    }
  }

  generateDynamicFields(input: GenerateFieldsInput) {
    return this.withFallback((c) => c.generateDynamicFields(input))
  }

  generateChecklist(input: GenerateChecklistInput) {
    return this.withFallback((c) => c.generateChecklist(input))
  }

  executeChecklistItem(input: ExecuteItemInput) {
    return this.withFallback((c) => c.executeChecklistItem(input))
  }
}
