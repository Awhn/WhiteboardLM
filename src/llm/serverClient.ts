import type { DynamicField } from '../workspace/types'
import { toLines } from '../checklist/parse'
import { getLLMConfig } from './config'
import type {
  ExecuteItemInput,
  GenerateChecklistInput,
  GenerateFieldsInput,
  LLMClient,
} from './types'

/** 서버 프록시(LiteLLM)에 키가 없을 때 — 스텁 폴백 신호 */
export class ServerUnavailableError extends Error {}

let fieldCounter = 0

/**
 * FastAPI 프록시(LiteLLM 멀티 프로바이더) 경유 LLM 클라이언트.
 * 설정(apiBase/model/apiKey)을 요청 시점에 읽어 헤더로 전달한다.
 * apiBase가 비어 있으면 ServerUnavailableError → 스텁 폴백.
 */
export class ServerLLMClient implements LLMClient {
  private async post<T>(path: string, body: unknown): Promise<T> {
    const { apiBase, model, apiKey } = getLLMConfig()
    if (!apiBase) {
      throw new ServerUnavailableError('백엔드 주소(apiBase)가 설정되지 않았습니다.')
    }
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (model) headers['X-LLM-Model'] = model
    if (apiKey) headers['X-LLM-Api-Key'] = apiKey

    let res: Response
    try {
      res = await fetch(`${apiBase}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })
    } catch (e) {
      // 네트워크 실패도 폴백 신호로 변환
      throw new ServerUnavailableError(
        `백엔드 연결 실패: ${e instanceof Error ? e.message : String(e)}`,
      )
    }
    if (res.status === 503) {
      const detail = (await res.json().catch(() => null))?.detail
      throw new ServerUnavailableError(detail ?? 'LLM 프로바이더 키가 설정되지 않았습니다.')
    }
    if (!res.ok) throw new Error(`서버 LLM 오류: HTTP ${res.status}`)
    return res.json() as Promise<T>
  }

  async proposeMission(input: import('./types').ProposeMissionInput): Promise<string> {
    const { mission } = await this.post<{ mission: string }>('/api/llm/mission', input)
    return mission
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

  async generateChecklist(input: GenerateChecklistInput): Promise<string[]> {
    // 백엔드 응답은 외부 입력 — 배열이 아니어도 안전하게 정규화한다.
    return toLines(await this.post<unknown>('/api/llm/checklist', input))
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
