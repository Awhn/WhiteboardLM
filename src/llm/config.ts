import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface LLMConfig {
  /** 백엔드 프록시 주소 (비어 있으면 스텁 사용) */
  apiBase: string
  /** LiteLLM 모델 문자열 (anthropic/… · openai/… · gemini/…). 비우면 서버 기본값 */
  model: string
  /** 사용자가 입력한 API 키 — 요청 헤더로 백엔드에 전달, 서버 env보다 우선 */
  apiKey: string
}

interface LLMConfigState extends LLMConfig {
  setConfig: (patch: Partial<LLMConfig>) => void
}

const DEFAULT_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? ''

export const useLLMConfig = create<LLMConfigState>()(
  persist(
    (set) => ({
      apiBase: DEFAULT_BASE,
      model: '',
      apiKey: '',
      setConfig: (patch) => set(patch),
    }),
    { name: 'whiteboardlm-llm-config' },
  ),
)

export const getLLMConfig = (): LLMConfig => useLLMConfig.getState()
