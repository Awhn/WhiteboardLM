import type { DynamicField } from '../workspace/types'
import { getLLMConfig } from './config'
import { ServerUnavailableError } from './serverClient'
import type {
  ExecuteItemInput,
  GenerateChecklistInput,
  GenerateFieldsInput,
  LLMClient,
} from './types'

const DEFAULT_MODEL = 'anthropic/claude-opus-4-8'

let fieldCounter = 0

function stripFences(text: string): string {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  return (m ? m[1] : text).trim()
}

/** 끝의 슬래시를 제거해 베이스 URL을 정규화 */
function trimBase(url: string): string {
  return url.replace(/\/+$/, '')
}

/**
 * "provider/model" 분해. 프로바이더 접두사가 없을 때:
 *  - 커스텀 엔드포인트가 있으면 OpenAI 호환 서버(Ollama·LM Studio·vLLM 등)로 간주
 *  - 없으면 Anthropic 기본
 */
function splitModel(model: string, hasEndpoint: boolean): { provider: string; id: string } {
  const m = (model || (hasEndpoint ? '' : DEFAULT_MODEL)).trim()
  const i = m.indexOf('/')
  if (i === -1) return { provider: hasEndpoint ? 'openai' : 'anthropic', id: m }
  return { provider: m.slice(0, i), id: m.slice(i + 1) }
}

/**
 * 커스텀 베이스 URL에 API 경로를 안전하게 결합한다.
 * 사용자가 베이스(`http://host:port`)·`/v1`·완전한 경로를 모두 줄 수 있으므로
 * 이미 접미사가 있으면 그대로 두고, 없으면 보강한다.
 */
function joinPath(base: string, v1Suffix: string): string {
  const suffix = v1Suffix.replace(/^\//, '') // "chat/completions" 또는 "messages"
  if (base.endsWith(`/${suffix}`)) return base
  if (base.endsWith('/v1')) return `${base}/${suffix}`
  return `${base}/v1/${suffix}`
}

/**
 * fetch 실패(특히 CORS 차단 → TypeError "Failed to fetch")를 사용자에게
 * 의미 있는 메시지로 변환한다.
 */
async function callJson(url: string, init: RequestInit, label: string): Promise<unknown> {
  let res: Response
  try {
    res = await fetch(url, init)
  } catch (e) {
    throw new Error(
      `${label} 연결 실패(${url}). 로컬 모드는 브라우저에서 직접 호출하므로 대상 서버가 ` +
        `CORS(Access-Control-Allow-Origin)를 허용해야 합니다. 예: Ollama는 OLLAMA_ORIGINS 설정 필요. ` +
        `원인: ${e instanceof Error ? e.message : String(e)}`,
      { cause: e },
    )
  }
  if (!res.ok) throw new Error(`${label} 오류: HTTP ${res.status} ${await res.text().catch(() => '')}`)
  return res.json()
}

/**
 * 단일 system+user 프롬프트로 텍스트를 받아온다. 프로바이더별 REST를 직접 호출.
 * (브라우저에서 키가 그대로 전송되므로 로컬/프로토타입 용도)
 */
async function chat(system: string, user: string, maxTokens: number): Promise<string> {
  const { model, apiKey, endpoint } = getLLMConfig()
  const base = trimBase(endpoint.trim())
  const { provider, id } = splitModel(model, base !== '')
  // 커스텀 엔드포인트(로컬 OpenAI 호환 서버 등)는 키가 없어도 호출 가능
  if (!apiKey && !base) throw new ServerUnavailableError('로컬 모드: API 키가 없습니다.')

  if (provider === 'anthropic') {
    const url = base ? joinPath(base, 'messages') : 'https://api.anthropic.com/v1/messages'
    const data = (await callJson(
      url,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: id,
          max_tokens: maxTokens,
          system,
          messages: [{ role: 'user', content: user }],
        }),
      },
      'Anthropic',
    )) as { content?: { type: string; text: string }[] }
    return (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('')
  }

  if (provider === 'gemini') {
    const root = base || 'https://generativelanguage.googleapis.com'
    const data = (await callJson(
      `${root}/v1beta/models/${id}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ parts: [{ text: user }] }],
          generationConfig: { maxOutputTokens: maxTokens },
        }),
      },
      'Gemini',
    )) as { candidates?: { content?: { parts?: { text: string }[] } }[] }
    return data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? ''
  }

  // 그 외(openai/ 또는 커스텀 엔드포인트의 임의 모델) → OpenAI 호환 채팅 API
  const url = base ? joinPath(base, 'chat/completions') : 'https://api.openai.com/v1/chat/completions'
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (apiKey) headers.authorization = `Bearer ${apiKey}`
  const data = (await callJson(
    url,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: id,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    },
    'OpenAI 호환',
  )) as { choices?: { message?: { content?: string } }[] }
  return data.choices?.[0]?.message?.content ?? ''
}

/**
 * 브라우저에서 프로바이더 API를 직접 호출하는 LLM 클라이언트 (로컬 모드).
 * 백엔드 불필요. 서버 도구(코드 실행 등)는 미지원.
 */
export class BrowserLLMClient implements LLMClient {
  async proposeMission({ capability, anchorName, anchorContent, context }: import('./types').ProposeMissionInput): Promise<string> {
    const text = await chat(
      `당신은 다음 역량을 가진 에이전트다: ${capability} 주어진 노드와 주변 컨텍스트를 보고, ` +
        '지금 수행하면 좋을 작업을 한국어 한 문장으로 제안한다. 따옴표·접두사·설명 없이 미션 문장만 출력.',
      `대상 노드: ${anchorName}\n내용:\n${anchorContent.slice(0, 800)}\n\n주변 컨텍스트:\n${(context ?? '').slice(0, 800)}`,
      256,
    )
    return text.trim().replace(/^["'「]|["'」]$/g, '')
  }

  async generateDynamicFields({ name, purpose }: GenerateFieldsInput): Promise<DynamicField[]> {
    const text = await chat(
      '당신은 선언형 작업 정의 도우미다. 작업 정의에 필요한 입력 필드를 JSON 배열로만 출력한다. ' +
        '각 원소: {"label": string, "type": "text"|"select"|"multiline"|"number", "options": string[]|null}. 3~5개. JSON 외 텍스트 금지.',
      `작업 이름: ${name}\n목적: ${purpose}`,
      2048,
    )
    const arr = JSON.parse(stripFences(text)) as Partial<DynamicField>[]
    return arr.map((f) => ({
      id: `field-br-${Date.now().toString(36)}-${(fieldCounter++).toString(36)}`,
      label: f.label ?? '필드',
      type: f.type ?? 'text',
      options: f.options ?? undefined,
      value: '',
    }))
  }

  async generateChecklist({ name, purpose }: GenerateChecklistInput): Promise<string[]> {
    const text = await chat(
      '당신은 작업 계획 도우미다. 미션을 실행 체크리스트로 만든다. 각 줄은 ' +
        "'[AI] 제목', '[인간] 제목', '[승인] 제목' 중 하나. 4~7줄, 줄바꿈 구분, 다른 텍스트 금지. 마지막 줄은 [승인] 항목.",
      `작업: ${name}\n미션: ${purpose}`,
      2048,
    )
    return text.split('\n').filter((l) => l.trim())
  }

  async executeChecklistItem({
    title,
    workspaceName,
    purpose,
    comment,
    context,
    toolResult,
  }: ExecuteItemInput): Promise<string> {
    const parts = [`작업공간: ${workspaceName}`, `미션: ${purpose}`, `수행할 단계: ${title}`]
    if (comment) parts.push(`반려 코멘트(반영): ${comment}`)
    if (context) parts.push(`공간 컨텍스트:\n${context}`)
    if (toolResult) parts.push(`도구 결과:\n${toolResult}`)
    return chat(
      '당신은 WhiteboardLM의 실행 에이전트다. 주어진 단계를 수행한 결과물을 마크다운으로 작성한다. 결과물 본문만 출력한다.',
      parts.join('\n\n'),
      4096,
    )
  }
}
