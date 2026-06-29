import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface LLMConfig {
  /** 백엔드 프록시 주소 (비어 있으면 스텁 사용) */
  apiBase: string
  /** 모델 문자열 (anthropic/… · openai/… · gemini/…). 비우면 서버 기본값 */
  model: string
  /** 사용자가 입력한 API 키 — 백엔드 헤더 전달 또는 로컬 모드에서 프로바이더로 직접 전송 */
  apiKey: string
  /** 로컬 모드: 백엔드 없이 브라우저에서 프로바이더 API를 직접 호출 */
  localMode: boolean
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
      localMode: false,
      setConfig: (patch) => set(patch),
    }),
    { name: 'whiteboardlm-llm-config' },
  ),
)

export const getLLMConfig = (): LLMConfig => useLLMConfig.getState()
