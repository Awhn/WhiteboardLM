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

/** "provider/model" 분해 */
function splitModel(model: string): { provider: string; id: string } {
  const m = (model || DEFAULT_MODEL).trim()
  const i = m.indexOf('/')
  return i === -1 ? { provider: 'anthropic', id: m } : { provider: m.slice(0, i), id: m.slice(i + 1) }
}

/**
 * 단일 system+user 프롬프트로 텍스트를 받아온다. 프로바이더별 REST를 직접 호출.
 * (브라우저에서 키가 그대로 전송되므로 로컬/프로토타입 용도)
 */
async function chat(system: string, user: string, maxTokens: number): Promise<string> {
  const { model, apiKey } = getLLMConfig()
  if (!apiKey) throw new ServerUnavailableError('로컬 모드: API 키가 없습니다.')
  const { provider, id } = splitModel(model)

  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
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
    })
    if (!res.ok) throw new Error(`Anthropic 오류: HTTP ${res.status} ${await res.text().catch(() => '')}`)
    const data = await res.json()
    return (data.content ?? []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('')
  }

  if (provider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: id,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    })
    if (!res.ok) throw new Error(`OpenAI 오류: HTTP ${res.status} ${await res.text().catch(() => '')}`)
    const data = await res.json()
    return data.choices?.[0]?.message?.content ?? ''
  }

  if (provider === 'gemini') {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${id}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ parts: [{ text: user }] }],
          generationConfig: { maxOutputTokens: maxTokens },
        }),
      },
    )
    if (!res.ok) throw new Error(`Gemini 오류: HTTP ${res.status} ${await res.text().catch(() => '')}`)
    const data = await res.json()
    return data.candidates?.[0]?.content?.parts?.map((p: { text: string }) => p.text).join('') ?? ''
  }

  throw new Error(`로컬 모드 미지원 프로바이더: ${provider}`)
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
