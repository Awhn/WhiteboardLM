/**
 * Agent 도구 실행 레이어 (M12).
 * Phase 2 프로토타입: 스텁 구현 — 서버 프록시(M15) 연결 시 실제 도구로 교체.
 */
export interface AgentTool {
  id: 'web_search' | 'file_read' | 'code_run'
  icon: string
  label: string
  /** 체크리스트 항목 제목으로 도구 사용 여부를 판별 */
  match: (title: string) => boolean
  run: (title: string, purpose: string) => Promise<string>
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const AGENT_TOOLS: AgentTool[] = [
  {
    id: 'web_search',
    icon: '🔍',
    label: '웹 검색',
    match: (title) => /검색|조사|자료/.test(title),
    run: async (title, purpose) => {
      await delay(500)
      return `🔍 웹 검색 결과 (스텁): "${purpose}" 관련 상위 3건 요약 — ${title}`
    },
  },
  {
    id: 'file_read',
    icon: '📄',
    label: '파일 읽기',
    match: (title) => /파일|문서 읽/.test(title),
    run: async (title) => {
      await delay(400)
      return `📄 파일 읽기 결과 (스텁): 요청한 문서의 핵심 내용 발췌 — ${title}`
    },
  },
  {
    id: 'code_run',
    icon: '🧮',
    label: '코드 실행',
    match: (title) => /코드|실행|계산/.test(title),
    run: async (title) => {
      await delay(600)
      return `🧮 코드 실행 결과 (스텁): 계산/검증 스크립트 정상 종료 (exit 0) — ${title}`
    },
  },
]

export const matchTool = (title: string): AgentTool | undefined =>
  AGENT_TOOLS.find((t) => t.match(title))

export const getToolById = (id: string): AgentTool | undefined =>
  AGENT_TOOLS.find((t) => t.id === id)
