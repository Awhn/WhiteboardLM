import type { AgentPersona } from './types'

export interface PersonaConfig {
  id: AgentPersona
  icon: string
  label: string
  /** 미션 추론·실행에 쓰는 역량 설명 (시스템 프롬프트) */
  capability: string
  /** 미션 추론 폴백(스텁/오류 시) 템플릿 */
  missionHint: (anchorName: string) => string
}

export const PERSONAS: Record<AgentPersona, PersonaConfig> = {
  researcher: {
    id: 'researcher',
    icon: '🔍',
    label: 'Researcher',
    capability: '주제에 대한 자료를 조사·비교하고 핵심을 정리한다.',
    missionHint: (n) => `「${n}」 관련 자료를 조사하고 핵심을 정리`,
  },
  writer: {
    id: 'writer',
    icon: '✍️',
    label: 'Writer',
    capability: '수집된 내용을 바탕으로 구조화된 초안을 작성한다.',
    missionHint: (n) => `「${n}」 내용을 바탕으로 초안 작성`,
  },
  summarizer: {
    id: 'summarizer',
    icon: '📚',
    label: 'Summarizer',
    capability: '여러 노드의 내용을 읽고 핵심을 요약한다.',
    missionHint: (n) => `「${n}」와 주변 내용을 핵심 위주로 요약`,
  },
  organizer: {
    id: 'organizer',
    icon: '🧹',
    label: 'Organizer',
    capability: '중복을 제거하고 내용을 그룹화·재배치한다.',
    missionHint: (n) => `「${n}」 주변 노드를 정리·그룹화`,
  },
  reviewer: {
    id: 'reviewer',
    icon: '🧐',
    label: 'Reviewer',
    capability: '논리적 허점과 개선점을 짚어 비판적으로 검토한다.',
    missionHint: (n) => `「${n}」 내용을 비판적으로 검토하고 개선점 제안`,
  },
}

export const PERSONA_LIST = Object.values(PERSONAS)

export const getPersona = (id: AgentPersona): PersonaConfig => PERSONAS[id]
